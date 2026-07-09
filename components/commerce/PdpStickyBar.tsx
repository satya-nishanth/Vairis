"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { WHATSAPP_URL } from "@/lib/ui-data";

type PdpStickyBarProps = {
  price: number | null | undefined;
  onAddToCart: () => void;
  addingToCart?: boolean;
  expertLabel?: string;
};

export function PdpStickyBar({ price, onAddToCart, addingToCart, expertLabel = "Talk to Expert" }: PdpStickyBarProps) {
  useEffect(() => {
    document.body.classList.add("has-mobile-sticky-bar");
    return () => document.body.classList.remove("has-mobile-sticky-bar");
  }, []);

  return (
    <div className="pdp-sticky-bar" role="region" aria-label="Purchase actions">
      <div className="pdp-sticky-bar__expert">
        {price != null && (
          <span className="pdp-sticky-bar__price">₹{price.toLocaleString("en-IN")}</span>
        )}
        <Link href={WHATSAPP_URL} className="pdp-sticky-bar__expert-link">
          <ThemeIcon name="jewellery_expert_phone" category="social" size={18} className="pdp-sticky-bar__expert-icon" />
          {expertLabel}
        </Link>
      </div>
      <div className="pdp-sticky-bar__actions">
        <button type="button" className="btn btn-primary" onClick={onAddToCart} disabled={addingToCart}>
          {addingToCart ? "Adding…" : "Add to Cart"}
        </button>
        <Link href="/checkout" className="btn btn-secondary">
          Buy Now
        </Link>
      </div>
    </div>
  );
}
