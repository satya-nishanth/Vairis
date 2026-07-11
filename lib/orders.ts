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
    description: "Refund processed to your payment method.",
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

/** Admin-driven transitions (webhook/system transitions have their own endpoints). */
export const ADMIN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PAYMENT_PENDING: ["CANCELLED"],
  PAYMENT_CONFIRMED: ["PREPARING", "CANCELLED", "FAILED_OTHER"],
  PREPARING: ["SHIPPED", "CANCELLED", "FAILED_OTHER"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY_FAILED", "FAILED_OTHER"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED", "FAILED_OTHER"],
  DELIVERY_FAILED: ["OUT_FOR_DELIVERY", "RETURNING_TO_ORIGIN", "FAILED_OTHER"],
  RETURNING_TO_ORIGIN: ["RTO_RECEIVED", "FAILED_OTHER"],
  RTO_RECEIVED: ["PREPARING", "CANCELLED", "FAILED_OTHER"],
  DELIVERED: ["RETURN_REQUESTED", "FAILED_OTHER"],
  DEPOSIT_REFUNDED: ["RETURN_REQUESTED", "FAILED_OTHER"],
  RETURN_REQUESTED: ["RETURN_IN_TRANSIT", "DELIVERED", "DEPOSIT_REFUNDED", "FAILED_OTHER"], // DELIVERED/DEPOSIT_REFUNDED = reject/revert (server validates revert target)
  RETURN_IN_TRANSIT: ["RETURN_RECEIVED", "FAILED_OTHER"],
  RETURN_RECEIVED: ["PREPARING", "FAILED_OTHER"], // QC fail → re-dispatch; QC pass goes through the refund endpoint
};

/** Extra manual marks for OFFLINE orders only (no gateway payment). */
export const OFFLINE_SETTLEMENT_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PAYMENT_PENDING: ["PAYMENT_CONFIRMED"],
  DELIVERED: ["DEPOSIT_REFUNDED"],
  CANCELLED: ["REFUNDED"],
  RETURN_RECEIVED: ["REFUNDED"],
  FAILED_OTHER: ["REFUNDED"],
};

/** from→to pairs whose PATCH requires a non-empty note. */
export const REASON_REQUIRED: [OrderStatus, OrderStatus][] = [
  ["SHIPPED", "DELIVERY_FAILED"],
  ["OUT_FOR_DELIVERY", "DELIVERY_FAILED"],
  ["RETURN_RECEIVED", "PREPARING"],
];

/** Statuses that ALWAYS require a reason note when transitioned into. */
export const REASON_REQUIRED_TARGETS: OrderStatus[] = ["FAILED_OTHER"];

export const TIMELINE_STEPS: OrderStatus[] = [
  "PAYMENT_CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "DEPOSIT_REFUNDED",
];

/** Orders in these states render the event-log timeline instead of happy-path steps. */
export function isHappyPath(status: OrderStatus): boolean {
  return (TIMELINE_STEPS as string[]).includes(status) || status === "PAYMENT_PENDING";
}
