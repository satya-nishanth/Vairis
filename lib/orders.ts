import type { OrderStatus } from "@prisma/client";

/**
 * Order lifecycle — single source of truth for statuses, transitions,
 * customer-facing labels, and the money model.
 *
 * ─── MONEY MODEL (pricing v2) ────────────────────────────────────────────
 * Customer pays exactly the displayed total:
 *   totalAmount = Σ line prices (GST-inclusive, from lib/pricing.ts —
 *                 includes the disclosed wastage line)
 *   grandTotal  = totalAmount            ← what the gateway captures
 * The 105%/5% refundable-deposit model is retired. depositAmount stays 0 on
 * new orders; DEPOSIT_REFUNDED remains a valid historical status so legacy
 * orders keep rendering. DELIVERED is the terminal happy state.
 * ─────────────────────────────────────────────────────────────────────────
 */

export function computeOrderAmounts(totalAmount: number): {
  totalAmount: number;
  grandTotal: number;
  depositAmount: number;
} {
  const grandTotal = Math.round(totalAmount);
  return { totalAmount: grandTotal, grandTotal, depositAmount: 0 };
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
    description: "Delivered. We hope you love your piece.",
    tone: "done",
  },
  // Historical status from the retired deposit model — legacy orders only.
  DEPOSIT_REFUNDED: {
    label: "Deposit Refunded",
    description: "Security deposit refunded to your payment method.",
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
  CANCELLED: ["REFUNDED"],
  RETURN_RECEIVED: ["REFUNDED"],
  FAILED_OTHER: ["REFUNDED"],
};

/** from→to pairs whose PATCH requires a non-empty note. */
export const REASON_REQUIRED: [OrderStatus, OrderStatus][] = [
  ["PAYMENT_PENDING", "PAYMENT_CONFIRMED"], // offline: URN / transaction ID
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
];

/** Admin order-detail journey map (horizontal standard flow). */
export const ADMIN_JOURNEY_STEPS: OrderStatus[] = [
  "PAYMENT_CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

/** Orders in these states render the event-log timeline instead of happy-path steps. */
export function isHappyPath(status: OrderStatus): boolean {
  return (
    (TIMELINE_STEPS as string[]).includes(status) ||
    status === "PAYMENT_PENDING" ||
    status === "DEPOSIT_REFUNDED" // legacy deposit-model orders
  );
}

/** Statuses that fork the journey off the fixed 5-step happy path. */
export const ADMIN_JOURNEY_BRANCH_STATUSES: OrderStatus[] = [
  "DELIVERY_FAILED",
  "RETURNING_TO_ORIGIN",
  "RTO_RECEIVED",
  "RETURN_REQUESTED",
  "RETURN_IN_TRANSIT",
  "RETURN_RECEIVED",
  "CANCELLED",
  "REFUNDED",
  "FAILED_OTHER",
];

/** Current status renders the dynamic journey map (not the off-flow event log). */
export function isOnAdminJourney(status: OrderStatus): boolean {
  return (
    (ADMIN_JOURNEY_STEPS as string[]).includes(status) ||
    (ADMIN_JOURNEY_BRANCH_STATUSES as string[]).includes(status) ||
    status === "PAYMENT_PENDING" ||
    status === "DEPOSIT_REFUNDED" // legacy terminal — show completed track
  );
}

export type AdminJourneyNodeState = "done" | "current" | "todo" | "failed";

export type AdminJourneyNode = {
  id: string;
  status: OrderStatus;
  label: string;
  enteredAt: Date | null;
  note: string | null;
  state: AdminJourneyNodeState;
  /** True when this node matches the order's live status. */
  isActive: boolean;
};

type OrderEventLike = {
  id: string;
  status: OrderStatus;
  createdAt: Date | string;
  note?: string | null;
};

const JOURNEY_TRACKED_STATUSES = new Set<OrderStatus>([
  "PAYMENT_CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERY_FAILED",
  "RETURNING_TO_ORIGIN",
  "RTO_RECEIVED",
  "DELIVERED",
  "DEPOSIT_REFUNDED",
  "RETURN_REQUESTED",
  "RETURN_IN_TRANSIT",
  "RETURN_RECEIVED",
  "CANCELLED",
  "REFUNDED",
  "FAILED_OTHER",
]);

const JOURNEY_REPEATABLE_STATUSES = new Set<OrderStatus>([
  "OUT_FOR_DELIVERY",
  "DELIVERY_FAILED",
  "PREPARING",
  "SHIPPED",
]);

const JOURNEY_TERMINAL_STATUSES = new Set<OrderStatus>([
  "DELIVERED",
  "DEPOSIT_REFUNDED",
  "REFUNDED",
  "CANCELLED",
  "FAILED_OTHER",
]);

function sortJourneyEvents(events: OrderEventLike[]): OrderEventLike[] {
  return [...events].sort((a, b) => {
    const ta =
      a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
    const tb =
      b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    return ta - tb;
  });
}

function toJourneyDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function buildStandardJourneyNodes(
  events: OrderEventLike[],
  currentStatus: OrderStatus,
): AdminJourneyNode[] {
  const currentIdx = (ADMIN_JOURNEY_STEPS as string[]).indexOf(currentStatus);
  const allComplete =
    currentStatus === "DELIVERED" || currentStatus === "DEPOSIT_REFUNDED";

  return ADMIN_JOURNEY_STEPS.map((step, i) => {
    const enteredAt = firstEnteredAt(events, step);
    let state: AdminJourneyNodeState = "todo";
    if (allComplete || (currentIdx >= 0 && i < currentIdx)) state = "done";
    else if (currentIdx >= 0 && i === currentIdx) state = "current";

    return {
      id: `standard-${step}`,
      status: step,
      label: ORDER_STATUS_META[step].label,
      enteredAt,
      note: null,
      state,
      isActive: i === currentIdx,
    };
  });
}

function buildDynamicJourneyNodes(
  events: OrderEventLike[],
  currentStatus: OrderStatus,
  createdAt: Date | string,
): AdminJourneyNode[] {
  const sorted = sortJourneyEvents(events);
  const nodes: AdminJourneyNode[] = [];
  let lastStatus: OrderStatus | null = null;
  const attemptCounts: Partial<Record<OrderStatus, number>> = {};

  if (currentStatus === "PAYMENT_PENDING") {
    nodes.push({
      id: "payment-pending",
      status: "PAYMENT_PENDING",
      label: ORDER_STATUS_META.PAYMENT_PENDING.label,
      enteredAt: toJourneyDate(createdAt),
      note: null,
      state: "current",
      isActive: true,
    });
  }

  for (const event of sorted) {
    if (!JOURNEY_TRACKED_STATUSES.has(event.status)) continue;
    if (event.status === lastStatus && !JOURNEY_REPEATABLE_STATUSES.has(event.status)) {
      continue;
    }

    if (JOURNEY_REPEATABLE_STATUSES.has(event.status)) {
      attemptCounts[event.status] = (attemptCounts[event.status] ?? 0) + 1;
    }

    let label = ORDER_STATUS_META[event.status].label;
    if (event.status === "OUT_FOR_DELIVERY" && (attemptCounts.OUT_FOR_DELIVERY ?? 0) > 1) {
      label = `Out for Delivery (${attemptCounts.OUT_FOR_DELIVERY})`;
    }
    if (event.status === "DELIVERY_FAILED" && (attemptCounts.DELIVERY_FAILED ?? 0) > 1) {
      label = `Delivery Attempt Failed (${attemptCounts.DELIVERY_FAILED})`;
    }

    nodes.push({
      id: event.id,
      status: event.status,
      label,
      enteredAt: toJourneyDate(event.createdAt),
      note: event.note ?? null,
      state: "done",
      isActive: false,
    });
    lastStatus = event.status;
  }

  if (nodes.length === 0) {
    return buildStandardJourneyNodes(events, currentStatus);
  }

  const lastIdx = nodes.length - 1;
  const isTerminal = JOURNEY_TERMINAL_STATUSES.has(currentStatus);

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === lastIdx;

    if (node.status === "DELIVERY_FAILED") {
      node.state = "failed";
      node.isActive = isLast && currentStatus === "DELIVERY_FAILED";
      continue;
    }

    if (isTerminal) {
      node.state = "done";
      node.isActive = isLast && node.status === currentStatus;
      continue;
    }

    if (isLast) {
      node.state = "current";
      node.isActive = node.status === currentStatus;
    } else {
      node.state = "done";
      node.isActive = false;
    }
  }

  return nodes;
}

/** Build admin order-detail journey nodes from events + current status. */
export function buildAdminJourneyNodes(
  events: OrderEventLike[],
  currentStatus: OrderStatus,
  createdAt: Date | string,
): AdminJourneyNode[] {
  const sorted = sortJourneyEvents(events);
  const hasBranch = sorted.some((e) =>
    (ADMIN_JOURNEY_BRANCH_STATUSES as string[]).includes(e.status),
  );

  if (!hasBranch && currentStatus !== "PAYMENT_PENDING") {
    return buildStandardJourneyNodes(events, currentStatus);
  }

  return buildDynamicJourneyNodes(events, currentStatus, createdAt);
}

/** Progress % for the mobile vertical rail (0–100). */
export function adminJourneyProgress(nodes: AdminJourneyNode[]): number {
  if (nodes.length <= 1) {
    return nodes.length === 1 && nodes[0].state === "done" ? 100 : 0;
  }

  if (nodes.some((n) => n.status === "DELIVERED" || n.status === "DEPOSIT_REFUNDED")) {
    const terminal = nodes.find(
      (n) => n.status === "DELIVERED" || n.status === "DEPOSIT_REFUNDED",
    );
    if (terminal?.state === "done") return 100;
  }

  let activeIdx = nodes.findIndex((n) => n.isActive);
  if (activeIdx < 0) {
    activeIdx = nodes.findLastIndex((n) => n.state === "done" || n.state === "failed");
  }
  if (activeIdx < 0) return 0;

  return Math.min(100, (activeIdx / (nodes.length - 1)) * 100);
}

type OrderEventLikeLegacy = { status: OrderStatus; createdAt: Date | string };

/** Earliest OrderEvent timestamp for a status, or null if never entered. */
export function firstEnteredAt(
  events: OrderEventLikeLegacy[],
  status: OrderStatus,
): Date | null {
  let earliest: Date | null = null;
  for (const e of events) {
    if (e.status !== status) continue;
    const t = e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt);
    if (!earliest || t < earliest) earliest = t;
  }
  return earliest;
}

/** Compact duration: `1 minute`, `3h 20m`, `3d 5h`. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return totalSec <= 1 ? "1 second" : `${totalSec} seconds`;
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return totalMin === 1 ? "1 minute" : `${totalMin} minutes`;
  const totalHrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (totalHrs < 24) {
    if (mins === 0) return totalHrs === 1 ? "1 hour" : `${totalHrs} hours`;
    return `${totalHrs}h ${mins}m`;
  }
  const days = Math.floor(totalHrs / 24);
  const hrs = totalHrs % 24;
  if (hrs === 0) return days === 1 ? "1 day" : `${days} days`;
  return `${days}d ${hrs}h`;
}

/**
 * Primary happy-path successor for the journey CTA.
 * Prefers the next ADMIN_JOURNEY_STEPS node over branch targets
 * (e.g. SHIPPED → OUT_FOR_DELIVERY, not DELIVERED / DELIVERY_FAILED).
 */
export function primaryNextStatus(
  status: OrderStatus,
  opts: { offline?: boolean } = {},
): OrderStatus | null {
  const allowed = new Set<OrderStatus>([
    ...(ADMIN_TRANSITIONS[status] ?? []),
    ...(opts.offline ? (OFFLINE_SETTLEMENT_TRANSITIONS[status] ?? []) : []),
  ]);

  const idx = (ADMIN_JOURNEY_STEPS as string[]).indexOf(status);
  if (idx >= 0 && idx < ADMIN_JOURNEY_STEPS.length - 1) {
    const preferred = ADMIN_JOURNEY_STEPS[idx + 1];
    if (allowed.has(preferred)) return preferred;
  }

  // PAYMENT_PENDING (offline) → PAYMENT_CONFIRMED
  if (status === "PAYMENT_PENDING" && allowed.has("PAYMENT_CONFIRMED")) {
    return "PAYMENT_CONFIRMED";
  }

  // Fallback: first allowed journey step (rare)
  for (const step of ADMIN_JOURNEY_STEPS) {
    if (allowed.has(step)) return step;
  }
  return null;
}

/** True when a from→to move (or the target alone) requires a reason note. */
export function transitionNeedsReason(from: OrderStatus, to: OrderStatus): boolean {
  return (
    REASON_REQUIRED.some(([f, t]) => f === from && t === to) ||
    REASON_REQUIRED_TARGETS.includes(to)
  );
}
