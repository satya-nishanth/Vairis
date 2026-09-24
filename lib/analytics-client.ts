"use client";

/**
 * First-party event tracker + optional GA4 mirror.
 *
 * track() posts to /api/events (AnalyticsEvent table) and, when
 * NEXT_PUBLIC_GA_ID is configured (gtag loaded in app/layout.tsx), mirrors
 * the event to GA4 with e-commerce params. Fire-and-forget — never blocks UI.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export type TrackName =
  | "page_view"
  | "pdp_view"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase";

const SESSION_KEY = "vairis_sid";

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    // Prefer sessionStorage so session identifier terminates when browser tab/session closes (SEC-08)
    let sid = window.sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.sessionStorage.setItem(SESSION_KEY, sid);
    }
    // Clean up any legacy permanent identifier from localStorage
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore storage restrictions
    }
    return sid;
  } catch {
    return "";
  }
}

const GA_EVENT_MAP: Record<TrackName, string> = {
  page_view: "page_view",
  pdp_view: "view_item",
  add_to_cart: "add_to_cart",
  begin_checkout: "begin_checkout",
  purchase: "purchase",
};

export function track(
  name: TrackName,
  data?: { productId?: string; meta?: Record<string, unknown> },
): void {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    name,
    path: window.location.pathname,
    productId: data?.productId,
    sessionId: getSessionId(),
    meta: data?.meta,
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // analytics must never break the store
  }

  try {
    window.gtag?.("event", GA_EVENT_MAP[name], {
      ...(data?.meta ?? {}),
      ...(data?.productId ? { items: [{ item_id: data.productId }] } : {}),
    });
  } catch {
    // ditto
  }
}
