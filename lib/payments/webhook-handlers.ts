import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { initiateRefund, statusAfterRefund } from "@/lib/refunds";
import type { Prisma } from "@prisma/client";
import type { PaymentWebhookEvent } from "./types";

/**
 * Domain transitions for normalized payment events — gateway-agnostic and
 * idempotent (gateways retry deliveries, and the browser verify endpoint
 * races payment.captured). Every handler checks current state before writing.
 *
 * Note: Payment.razorpayOrderId / razorpayPaymentId / razorpayRefundId
 * columns store whatever the ACTIVE gateway's ids are — the names are
 * historical, the code treats them as generic gateway ids.
 */
export async function applyPaymentWebhookEvent(event: PaymentWebhookEvent): Promise<void> {
  switch (event.type) {
    case "payment.captured":
      return handleCaptured(event.gatewayOrderId, event.gatewayPaymentId);
    case "payment.failed":
      return handleFailed(event.gatewayOrderId, event.reason);
    case "refund.processed":
      return handleRefundProcessed(event.gatewayPaymentId, event.gatewayRefundId, event.amount);
    case "ignored":
      return;
  }
}

/** Shared by the webhook AND the browser verify endpoint — one transition, two triggers. */
export async function confirmPayment(
  gatewayOrderId: string,
  gatewayPaymentId: string,
  note: string,
): Promise<{ orderId: string; userId: string } | null> {
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: gatewayOrderId },
    include: { order: true },
  });
  if (!payment) return null;

  // Late capture on a dead order: never resurrect — refund in full instead.
  if (payment.order.status === "PAYMENT_EXPIRED" || payment.order.status === "CANCELLED") {
    if (payment.status !== "CAPTURED") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "CAPTURED", razorpayPaymentId: gatewayPaymentId },
      });
      await prisma.orderEvent.create({
        data: {
          orderId: payment.orderId,
          status: payment.order.status,
          note: "⚠ Payment received after order expiry/cancellation — auto-refund initiated",
        },
      });
      await initiateRefund({
        orderId: payment.orderId,
        kind: "FULL",
        reason: "Automatic: payment captured after order expired/cancelled",
      });
    }
    return { orderId: payment.orderId, userId: payment.order.userId };
  }

  // Idempotent: the other trigger may have confirmed this already.
  if (payment.status !== "CAPTURED") {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "CAPTURED", razorpayPaymentId: gatewayPaymentId },
      }),
      prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: "PAYMENT_CONFIRMED",
          events: { create: { status: "PAYMENT_CONFIRMED", note } },
        },
      }),
      // Clear the cart on confirmation — covers the customer who paid but
      // closed the tab before the browser verify call fired.
      prisma.cartItem.deleteMany({ where: { userId: payment.order.userId } }),
    ]);
    // Fire-and-forget — the idempotency guard above means exactly one send
    // even when verify and the webhook race.
    void sendOrderConfirmationEmail(payment.orderId);
  }
  return { orderId: payment.orderId, userId: payment.order.userId };
}

async function handleCaptured(gatewayOrderId: string, gatewayPaymentId: string) {
  await confirmPayment(gatewayOrderId, gatewayPaymentId, "Payment captured (webhook)");
}

async function handleFailed(gatewayOrderId: string, reason: string | null) {
  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: gatewayOrderId } });
  // Never regress a captured payment — a failed retry attempt can arrive
  // after a successful attempt on the same gateway order.
  if (!payment || payment.status === "CAPTURED") return;

  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } }),
    prisma.orderEvent.create({
      data: {
        orderId: payment.orderId,
        status: "PAYMENT_PENDING",
        note: `Payment attempt failed${reason ? `: ${reason}` : ""}`,
      },
    }),
  ]);
}

async function handleRefundProcessed(
  gatewayPaymentId: string,
  gatewayRefundId: string,
  amount: number,
) {
  // Ledger-matched: the initiation declared the intent; apply it verbatim.
  const ledger = await prisma.orderRefund.findUnique({ where: { gatewayRefundId } });
  if (!ledger) {
    console.error(`refund.processed for unknown refund ${gatewayRefundId} — record manually`);
    return;
  }
  if (ledger.status === "COMPLETED") return; // duplicate delivery

  const order = await prisma.order.findUnique({ where: { id: ledger.orderId } });
  if (!order) return;
  const next = statusAfterRefund(ledger.kind, order.status);

  const payment = await prisma.payment.findFirst({ where: { razorpayPaymentId: gatewayPaymentId } });

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.orderRefund.update({ where: { id: ledger.id }, data: { status: "COMPLETED" } }),
    ...(payment
      ? [
          prisma.payment.update({
            where: { id: payment.id },
            data: {
              razorpayRefundId: gatewayRefundId,
              refundedAmount: Number(payment.refundedAmount) + amount,
              status:
                Number(payment.refundedAmount) + amount >= Number(payment.amount) - 0.01
                  ? "REFUNDED"
                  : "PARTIALLY_REFUNDED",
            },
          }),
        ]
      : []),
    ...(next
      ? [
          prisma.order.update({
            where: { id: order.id },
            data: {
              status: next,
              events: {
                create: { status: next, note: `₹${amount.toLocaleString("en-IN")} refund completed` },
              },
            },
          }),
        ]
      : [
          prisma.orderEvent.create({
            data: { orderId: order.id, status: order.status, note: `₹${amount.toLocaleString("en-IN")} refund completed` },
          }),
        ]),
  ];
  await prisma.$transaction(ops);
}
