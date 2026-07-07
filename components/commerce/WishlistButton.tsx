"use client";

import { useCallback, useState } from "react";
import { useWishlist } from "@/components/commerce/WishlistProvider";
import { ThemeIcon } from "@/components/icons/ThemeIcon";

type WishlistButtonProps = {
  productId: string;
  productName: string;
};

export function WishlistButton({ productId, productName }: WishlistButtonProps) {
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
      className={`product-card__wish${active ? " is-active" : ""}`}
      aria-label={active ? `Remove ${productName} from wishlist` : `Add ${productName} to wishlist`}
      aria-pressed={active}
      onClick={handleClick}
    >
      <ThemeIcon name="wishlist_heart" category="navigation" size={18} className="product-card__wish-icon" />
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
