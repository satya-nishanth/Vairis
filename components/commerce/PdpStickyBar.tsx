"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { WHATSAPP_URL } from "@/lib/ui-data";
import { CHECKOUT_ENABLED } from "@/lib/flags";

type PdpStickyBarProps = {
  price: number | null | undefined;
  onAddToCart: () => void;
  addingToCart?: boolean;
  expertLabel?: string;
  whatsappHref?: string;
  onExpertClick?: () => void;
  canPurchase?: boolean;
};

export function PdpStickyBar({
  price,
  onAddToCart,
  addingToCart,
  expertLabel = "Talk to Expert",
  whatsappHref = WHATSAPP_URL,
  onExpertClick,
  canPurchase = true,
}: PdpStickyBarProps) {
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
        {onExpertClick ? (
          <button type="button" onClick={onExpertClick} className="pdp-sticky-bar__expert-link">
            <ThemeIcon name="jewellery_expert_phone" category="social" size={18} className="pdp-sticky-bar__expert-icon" />
            {expertLabel}
          </button>
        ) : (
          <Link href={whatsappHref} className="pdp-sticky-bar__expert-link">
            <ThemeIcon name="jewellery_expert_phone" category="social" size={18} className="pdp-sticky-bar__expert-icon" />
            {expertLabel}
          </Link>
        )}
      </div>
      {/* Cart/Buy hidden until CHECKOUT_ENABLED (Razorpay go-live), or when
          this product's price is hidden — the expert WhatsApp link above
          stays as the purchase path in both cases */}
      {CHECKOUT_ENABLED && canPurchase && (
        <div className="pdp-sticky-bar__actions">
          <button type="button" className="btn btn-primary" onClick={onAddToCart} disabled={addingToCart}>
            {addingToCart ? "Adding…" : "Add to Cart"}
          </button>
          <Link href="/checkout" className="btn btn-secondary">
            Buy Now
          </Link>
        </div>
      )}
    </div>
  );
}
