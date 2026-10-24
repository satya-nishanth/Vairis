"use client";

import { useCallback, useState } from "react";
import { useWishlist } from "@/components/commerce/WishlistProvider";
import { ThemeIcon } from "@/components/icons/ThemeIcon";

type WishlistButtonProps = {
  productId: string;
  productName: string;
  /** "card" (default): absolutely-positioned circle over a PLP image — needs
   * a positioned image-wrapper ancestor. "inline": a normal in-flow circular
   * button for contexts without one, e.g. the PDP actions row. */
  variant?: "card" | "inline";
  className?: string;
};

export function WishlistButton({
  productId,
  productName,
  variant = "card",
  className,
}: WishlistButtonProps) {
  const { has, toggle } = useWishlist();
  const active = has(productId);
  const [burst, setBurst] = useState(false);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const added = toggle(productId);
      if (added) {
        setBurst(true);
        window.setTimeout(() => setBurst(false), 900);
      }
    },
    [productId, toggle],
  );

  return (
    <button
      type="button"
      className={`product-card__wish${variant === "inline" ? " product-card__wish--inline" : ""}${active ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      aria-label={active ? `Remove ${productName} from wishlist` : `Add ${productName} to wishlist`}
      aria-pressed={active}
      onClick={handleClick}
    >
      {active ? (
        <svg className="product-card__wish-filled" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21s-7.5-4.7-9.6-9.2C.9 8.4 2.7 4.5 6.4 4.5c2 0 3.8 1.1 5.6 3.3 1.8-2.2 3.6-3.3 5.6-3.3 3.7 0 5.5 3.9 4 7.3C19.5 16.3 12 21 12 21z" />
        </svg>
      ) : (
        <ThemeIcon name="wishlist_heart" category="navigation" size={18} className="product-card__wish-icon" />
      )}
      {burst && (
        <span className="wish-burst" aria-hidden>
          {["💕", "✨", "💖", "✨", "💕"].map((emoji, i) => (
            <span key={i} className="wish-burst__particle" style={{ ["--i" as string]: i }}>
              {emoji}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
