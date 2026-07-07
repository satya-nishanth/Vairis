"use client";

import Link from "next/link";
import { useEffect } from "react";
import { formatPrice } from "@/lib/ui-data";

type MobileCheckoutBarProps = {
  total: number;
  href: string;
  label?: string;
  totalLabel?: string;
};

export function MobileCheckoutBar({
  total,
  href,
  label = "Proceed to Checkout",
  totalLabel = "Total",
}: MobileCheckoutBarProps) {
  useEffect(() => {
    document.body.classList.add("has-mobile-sticky-bar");
    return () => document.body.classList.remove("has-mobile-sticky-bar");
  }, []);

  return (
    <div className="mobile-checkout-bar" role="region" aria-label="Checkout summary">
      <div className="mobile-checkout-bar__total">
        <span className="mobile-checkout-bar__label">{totalLabel}</span>
        <span className="mobile-checkout-bar__amount">{formatPrice(total)}</span>
      </div>
      <Link href={href} className="btn btn-primary mobile-checkout-bar__cta">
        {label}
      </Link>
    </div>
  );
}
