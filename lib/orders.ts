import type { OrderStatus } from "@prisma/client";

/**
 * Order lifecycle — single source of truth for statuses, transitions,
 * customer-facing labels, and the 105%/5% deposit money model.
 *
 * ─── MONEY MODEL (jewellery security deposit) ────────────────────────────
 * At checkout the customer pays 105% of the goods total:
 *   totalAmount   = Σ line prices (GST-inclusive, from lib/pricing.ts)
 *   grandTotal    = round(totalAmount × 1.05)  ← what Razorpay captures
 *   depositAmount = grandTotal − totalAmount   ← refunded after delivery
 * After the order is DELIVERED, admin triggers a partial Razorpay refund of
 * depositAmount; the refund.processed webhook flips status to
 * DEPOSIT_REFUNDED — the terminal happy state.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const DEPOSIT_RATE = 0.05;

export function computeOrderAmounts(totalAmount: number): {
  totalAmount: number;
  grandTotal: number;
  depositAmount: number;
} {
  const grandTotal = Math.round(totalAmount * (1 + DEPOSIT_RATE));
  return { totalAmount, grandTotal, depositAmount: grandTotal - totalAmount };
}

/** Customer-facing labels + timeline copy per status. */
export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; description: string; tone: "pending" | "active" | "done" | "bad" }
> = {
  PENDING: {
    label: "Payment Pending",
    description: "Order created — awaiting payment.",
    tone: "pending",
  },
  PAYMENT_CONFIRMED: {
    label: "Payment Confirmed",
    description: "Payment received. We're preparing your order.",
    tone: "active",
  },
  PROCESSING: {
    label: "Being Crafted",
    description: "Your piece is being prepared and quality-checked.",
    tone: "active",
  },
  SHIPPED: {
    label: "Shipped",
    description: "On its way with insured delivery.",
    tone: "active",
  },
  DELIVERED: {
    label: "Delivered",
    description: "Delivered. Your 5% security deposit refund is being processed.",
    tone: "done",
  },
  DEPOSIT_REFUNDED: {
    label: "Deposit Refunded",
    description: "5% security deposit refunded to your payment method.",
    tone: "done",
  },
  CANCELLED: {
    label: "Cancelled",
    description: "Order cancelled.",
    tone: "bad",
  },
  REFUNDED: {
    label: "Refunded",
    description: "Full amount refunded to your payment method.",
    tone: "bad",
  },
};

/**
 * Valid admin-driven transitions. Webhook-driven transitions
 * (PENDING→PAYMENT_CONFIRMED, DELIVERED→DEPOSIT_REFUNDED, →REFUNDED)
 * are handled by their endpoints, not this map.
 */
export const ADMIN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PAYMENT_CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
};

/** Ordered steps for the customer timeline (happy path). */
export const TIMELINE_STEPS: OrderStatus[] = [
  "PAYMENT_CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "DEPOSIT_REFUNDED",
];
