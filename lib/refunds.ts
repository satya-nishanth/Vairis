import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payments";
import type { OrderStatus, Prisma, RefundKind } from "@prisma/client";

/**
 * Refund ledger — every rupee returned (gateway or offline) is an OrderRefund
 * row with DECLARED intent. The refund.processed webhook matches rows by
 * gatewayRefundId and applies that intent; amounts are never inferred.
 * For split children the gateway payment lives on the PARENT (spec §5) —
 * resolvePayment walks up.
 */

export async function resolvePayment(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true, parent: { include: { payment: true } } },
  });
  if (!order) return null;
  return { order, payment: order.payment ?? order.parent?.payment ?? null };
}

/** Total captured available to this order (child = its own grandTotal slice). */
export function capturedFor(order: { grandTotal: unknown }): number {
  return Number(order.grandTotal);
}

export async function refundedSoFar(orderId: string): Promise<number> {
  const rows = await prisma.orderRefund.findMany({ where: { orderId } });
  return rows.reduce((s, r) => s + Number(r.amount), 0);
}

export function statusAfterRefund(kind: RefundKind, current: OrderStatus): OrderStatus | null {
  if (kind === "DEPOSIT") return "DEPOSIT_REFUNDED";
  if (kind === "FULL") return "REFUNDED";
  // PARTIAL settles the order only where a refund is the resolution step
  return current === "CANCELLED" || current === "RETURN_RECEIVED" || current === "FAILED_OTHER"
    ? "REFUNDED"
    : null;
}

export async function initiateRefund(params: {
  orderId: string;
  kind: RefundKind;
  amount?: number;
  reason: string;
}): Promise<{ ok: true; amount: number } | { ok: false; error: string; code: number }> {
  const resolved = await resolvePayment(params.orderId);
  if (!resolved) return { ok: false, error: "Order not found", code: 404 };
  const { order, payment } = resolved;

  const already = await refundedSoFar(order.id);
  const remaining = capturedFor(order) - already;

  const amount =
    params.kind === "DEPOSIT"
      ? Number(order.depositAmount)
      : params.kind === "FULL"
        ? remaining
        : Math.round(params.amount ?? 0);

  if (!params.reason.trim()) return { ok: false, error: "Reason is required", code: 400 };
  if (amount <= 0) return { ok: false, error: "Nothing to refund", code: 409 };
  if (amount > remaining + 0.01)
    return { ok: false, error: `Exceeds remaining refundable ₹${remaining.toLocaleString("en-IN")}`, code: 409 };
  if (params.kind === "DEPOSIT") {
    if (order.status !== "DELIVERED")
      return { ok: false, error: "Deposit refunds happen after delivery", code: 409 };
    const priorDeposit = await prisma.orderRefund.findFirst({
      where: { orderId: order.id, kind: "DEPOSIT" },
    });
    if (priorDeposit) return { ok: false, error: "Deposit already refunded", code: 409 };
  }

  // OFFLINE order (no gateway payment anywhere): ledger row + immediate transition mark.
  if (!payment?.razorpayPaymentId) {
    const next = statusAfterRefund(params.kind, order.status);
    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.orderRefund.create({
        data: {
          orderId: order.id,
          amount,
          kind: params.kind,
          method: "OFFLINE",
          reason: params.reason,
          status: "COMPLETED",
        },
      }),
      ...(next
        ? [
            prisma.order.update({
              where: { id: order.id },
              data: {
                status: next,
                events: {
                  create: {
                    status: next,
                    note: `₹${amount.toLocaleString("en-IN")} returned offline — ${params.reason}`,
                  },
                },
              },
            }),
          ]
        : [
            prisma.orderEvent.create({
              data: {
                orderId: order.id,
                status: order.status,
                note: `₹${amount.toLocaleString("en-IN")} returned offline — ${params.reason}`,
              },
            }),
          ]),
    ];
    await prisma.$transaction(ops);
    return { ok: true, amount };
  }

  // GATEWAY: create the gateway refund, record INITIATED intent; the
  // refund.processed webhook completes it and flips the status.
  const gateway = getPaymentGateway();
  if (!gateway.isConfigured())
    return { ok: false, error: `Payment gateway (${gateway.name}) not configured`, code: 503 };

  let gatewayRefundId: string;
  try {
    const result = await gateway.createRefund(payment.razorpayPaymentId, amount, {
      order_id: order.id,
      reason: params.reason.slice(0, 250),
    });
    gatewayRefundId = result.gatewayRefundId;
  } catch (err) {
    console.error("refund initiation failed", err);
    return { ok: false, error: "Gateway refused the refund — check the gateway dashboard", code: 502 };
  }

  await prisma.$transaction([
    prisma.orderRefund.create({
      data: { orderId: order.id, amount, kind: params.kind, method: "GATEWAY", gatewayRefundId, reason: params.reason },
    }),
    prisma.orderEvent.create({
      data: {
        orderId: order.id,
        status: order.status,
        note: `Refund of ₹${amount.toLocaleString("en-IN")} initiated — ${params.reason}`,
      },
    }),
  ]);
  return { ok: true, amount };
}
