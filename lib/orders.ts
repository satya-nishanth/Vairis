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
  PAYMENT_PENDING: {
    label: "Payment Pending",
    description: "Order created — awaiting payment.",
    tone: "pending",
  },
  PAYMENT_CONFIRMED: {
    label: "Payment Confirmed",
    description: "Payment received. We're preparing your order.",
    tone: "active",
  },
  PREPARING: {
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
  // New v2 states — labels per spec; behavior/transitions land in later tasks.
  PAYMENT_EXPIRED: {
    label: "Payment Expired",
    description: "Payment window closed. Place the order again anytime.",
    tone: "bad",
  },
  OUT_FOR_DELIVERY: {
    label: "Out for Delivery",
    description: "Arriving today — keep your phone handy for the courier.",
    tone: "active",
  },
  DELIVERY_FAILED: {
    label: "Delivery Attempt Failed",
    description: "The courier couldn't deliver. We'll retry or reach out.",
    tone: "pending",
  },
  RETURNING_TO_ORIGIN: {
    label: "Returning to Us",
    description: "The package is on its way back to us.",
    tone: "pending",
  },
  RTO_RECEIVED: {
    label: "Back With Us",
    description: "We've received the package back and will be in touch.",
    tone: "pending",
  },
  RETURN_REQUESTED: {
    label: "Return Requested",
    description: "We've received your return request and will confirm pickup.",
    tone: "pending",
  },
  RETURN_IN_TRANSIT: {
    label: "Return Pickup",
    description: "Your return is on its way back to us.",
    tone: "active",
  },
  RETURN_RECEIVED: {
    label: "Return Received",
    description: "We've received your return and it's being inspected.",
    tone: "active",
  },
  SPLIT_INTO_DELIVERIES: {
    label: "Multiple Deliveries",
    description: "Your order ships as separate deliveries — track each below.",
    tone: "active",
  },
  FAILED_OTHER: {
    label: "Order Failed",
    description: "Something went wrong with this order — see the timeline. Any refund due is being processed.",
    tone: "bad",
  },
};

/**
 * Valid admin-driven transitions. Webhook-driven transitions
 * (PAYMENT_PENDING→PAYMENT_CONFIRMED, DELIVERED→DEPOSIT_REFUNDED, →REFUNDED)
 * are handled by their endpoints, not this map.
 */
export const ADMIN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PAYMENT_CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
};

/**
 * EXTRA transitions allowed only for OFFLINE orders (manual/WhatsApp sales,
 * no gateway payment): money moves by hand (UPI/bank transfer), so the admin
 * marks the settlement instead of a refund webhook doing it.
 * Gateway-paid orders never use these — their refunds go through
 * /api/admin/orders/[id]/refund and the refund.processed webhook.
 */
export const OFFLINE_SETTLEMENT_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PAYMENT_PENDING: ["PAYMENT_CONFIRMED", "CANCELLED"], // payment arrived offline / deal fell through
  DELIVERED: ["DEPOSIT_REFUNDED"], // deposit returned via UPI/bank
  CANCELLED: ["REFUNDED"], // money returned via UPI/bank
};

/** Ordered steps for the customer timeline (happy path). */
export const TIMELINE_STEPS: OrderStatus[] = [
  "PAYMENT_CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "DEPOSIT_REFUNDED",
];
