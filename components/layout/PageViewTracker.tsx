"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics-client";

/** Logs a page_view event on every route change (first-party + GA4). */
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    track("page_view");
  }, [pathname]);

  return null;
}
