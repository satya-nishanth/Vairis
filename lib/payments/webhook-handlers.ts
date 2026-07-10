import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationEmail } from "@/lib/email";
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
        status: "PENDING",
        note: `Payment attempt failed${reason ? `: ${reason}` : ""}`,
      },
    }),
  ]);
}

/**
 * refund.processed fires for both refund types we issue:
 *  - 5% security deposit after delivery → order DEPOSIT_REFUNDED
 *  - full refund on cancellation        → order REFUNDED
 * Distinguished by cumulative refunded amount vs the payment amount.
 */
async function handleRefundProcessed(
  gatewayPaymentId: string,
  gatewayRefundId: string,
  amount: number,
) {
  const payment = await prisma.payment.findFirst({
    where: { razorpayPaymentId: gatewayPaymentId },
  });
  if (!payment) return;
  if (payment.razorpayRefundId === gatewayRefundId) return; // duplicate delivery

  const cumulative = Number(payment.refundedAmount) + amount;
  const isFullRefund = cumulative >= Number(payment.amount) - 0.01;

  const orderStatus = isFullRefund ? "REFUNDED" : "DEPOSIT_REFUNDED";
  const note = isFullRefund
    ? `Full refund of ₹${cumulative.toLocaleString("en-IN")} processed`
    : `Security deposit of ₹${amount.toLocaleString("en-IN")} refunded`;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayRefundId: gatewayRefundId,
        refundedAmount: cumulative,
        status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    }),
    prisma.order.update({
      where: { id: payment.orderId },
      data: { status: orderStatus, events: { create: { status: orderStatus, note } } },
    }),
  ]);
}
