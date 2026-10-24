"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { WHATSAPP_URL } from "@/lib/ui-data";
import { CHECKOUT_ENABLED } from "@/lib/flags";

type PdpStickyBarProps = {
  price: number | null | undefined;
  wasPrice?: number;
  planLabel?: string;
  switchNudge?: { text: string; onSwitch: () => void };
  onAddToCart: () => void;
  addingToCart?: boolean;
  onBuyNow?: () => void;
  buyingNow?: boolean;
  expertLabel?: string;
  whatsappHref?: string;
  onExpertClick?: () => void;
  canPurchase?: boolean;
};

export function PdpStickyBar({
  price,
  wasPrice,
  planLabel,
  switchNudge,
  onAddToCart,
  addingToCart,
  onBuyNow,
  buyingNow,
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
      {switchNudge && (
        <button type="button" className="pdp-sticky-bar__nudge" onClick={switchNudge.onSwitch}>
          <span>{switchNudge.text}</span>
          <b>Switch</b>
        </button>
      )}
      <div className="pdp-sticky-bar__expert">
        {price != null && (
          <span className="pdp-sticky-bar__price">
            {wasPrice != null && (
              <s className="pdp-sticky-bar__was">₹{wasPrice.toLocaleString("en-IN")}</s>
            )}
            ₹{price.toLocaleString("en-IN")}
            {planLabel && <small className="pdp-sticky-bar__plan">{planLabel}</small>}
          </span>
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
          <button type="button" className="btn btn-primary" onClick={onAddToCart} disabled={addingToCart || buyingNow}>
            {addingToCart ? "Adding…" : "Add to cart"}
          </button>
          {onBuyNow ? (
            <button type="button" className="btn btn-secondary" onClick={onBuyNow} disabled={buyingNow || addingToCart}>
              {buyingNow ? "Processing…" : "Buy now"}
            </button>
          ) : (
            <Link href="/checkout" className="btn btn-secondary">
              Buy now
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
