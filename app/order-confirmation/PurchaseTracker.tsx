"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics-client";

/** Fires the purchase event exactly once per order (localStorage dedupe). */
export function PurchaseTracker({ orderId, value }: { orderId: string; value: number }) {
  useEffect(() => {
    try {
      const key = `vairis_purchase_${orderId}`;
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      // private mode — still track, may double-fire on refresh
    }
    track("purchase", { meta: { orderId, value, currency: "INR" } });
  }, [orderId, value]);

  return null;
}
