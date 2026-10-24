"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/ui-data";
import { formatPrice } from "@/lib/ui-data";
import { ProductImage } from "@/components/ui/ProductImage";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { useCart } from "@/components/commerce/CartProvider";
import { CHECKOUT_ENABLED } from "@/lib/flags";
import { useCartModal } from "./CartModal";

import { formatDisplayName } from "@/lib/prisma-to-product";

type ProductCardProps = {
  product: Product;
  showActions?: boolean;
  linkPrefix?: string;
  collectionSlug?: string;
  /** PLP: flip cards with a worn photo to it (the hover photo, slot 7). */
  worn?: boolean;
  /** PLP: swipe a card to see its other photo, with position dots. */
  swipeable?: boolean;
  /** PLP: remember this card so Back restores the page. */
  onOpen?: () => void;
};

function QuickAddButton({ product }: { product: Product }) {
  const { addItem, isLoggedIn, hydrated } = useCart();
  const { openCartModal } = useCartModal();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleQuickAdd = async () => {
    if (!product.variantId) return;
    if (hydrated && !isLoggedIn) {
      router.push(`/auth/login?next=${encodeURIComponent(`/product/${product.slug}`)}&reason=cart`);
      return;
    }
    setAdding(true);
    try {
      await addItem(product.variantId, 1);
      openCartModal();
    } catch {
      setFailed(true);
      window.setTimeout(() => setFailed(false), 2500);
    } finally {
      setAdding(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn-secondary btn--sm product-card__quick-add"
      onClick={handleQuickAdd}
      disabled={adding}
    >
      {adding ? "Adding…" : failed ? "Try again" : "Quick Add"}
    </button>
  );
}

export function ProductCard({
  product,
  showActions = true,
  linkPrefix = "/product",
  collectionSlug,
  worn = false,
  swipeable = false,
  onOpen,
}: ProductCardProps) {
  const [flipped, setFlipped] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const href = collectionSlug
    ? `${linkPrefix}/${product.slug}?collection=${encodeURIComponent(collectionSlug)}`
    : `${linkPrefix}/${product.slug}`;
  const productId = product.catalogueId ?? product.slug;
  const displayName = formatDisplayName(product.name, product.category);
  const hoverSrc = product.hoverImage && product.hoverImage !== product.image ? product.hoverImage : null;
  // No ribbon without a visible price — "8% off" on "Price on Request" (STG-67).
  const salePercent =
    product.price != null && product.autoDiscountPercent && product.autoDiscountPercent > 0
      ? Math.round(product.autoDiscountPercent)
      : null;
  // Ribbon owns the sale callout — skip duplicate "% off" pill badge.
  const showBadge = Boolean(product.badge) && salePercent == null;
  // Worn view shows the worn photo first; a swipe flips whichever photo is showing.
  const wornShown = Boolean(hoverSrc) && worn !== flipped;
  const onHandLabel = worn && hoverSrc && !flipped;

  const classes = [
    "product-card",
    hoverSrc && "product-card--has-hover",
    wornShown && "product-card--worn",
  ]
    .filter(Boolean)
    .join(" ");

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!swipeable || !hoverSrc || !start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.5) setFlipped((f) => !f);
  };

  return (
    <article className={classes} data-product-id={productId}>
      <div
        className="product-card__img-wrap"
        onTouchStart={(e) => {
          touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={onTouchEnd}
      >
        <Link href={href} className="product-card__img-link" tabIndex={-1} aria-hidden="true" onClick={onOpen}>
          {showBadge && <span className="product-card__badge">{product.badge}</span>}
          {salePercent != null && (
            <span className="product-card__sale-ribbon" aria-label={`${salePercent}% off`}>
              {salePercent}% off
            </span>
          )}
          <ProductImage src={product.image} alt="" fill className="product-card__img product-card__img--face" />
          {hoverSrc ? (
            <ProductImage src={hoverSrc} alt="" fill className="product-card__img product-card__img--hover" />
          ) : null}
        </Link>
        {onHandLabel && <span className="product-card__worn-label">Shown in yellow gold</span>}
        {swipeable && hoverSrc && (
          <span className="product-card__dots" aria-hidden="true">
            <span className={wornShown ? "" : "is-active"} />
            <span className={wornShown ? "is-active" : ""} />
          </span>
        )}
        <WishlistButton
          productId={productId}
          productName={displayName}
          className={salePercent != null ? "product-card__wish--with-sale" : undefined}
        />
      </div>
      <div className="product-card__body">
        <h3 className="product-card__title">
          <Link href={href} onClick={onOpen}>{displayName}</Link>
        </h3>
        <p className="product-card__desc">{product.description || '\u00A0'}</p>
        <div className="product-card__footer">
          {product.price != null ? (
            <p className="product-card__price">
              {salePercent != null ? (
                <>
                  {product.hasMultiplePrices ? <span>From </span> : null}
                  <span style={{ textDecoration: "line-through", opacity: 0.55, marginRight: 8 }}>
                    {formatPrice(product.price)}
                  </span>
                  <span>
                    {formatPrice(
                      Math.max(0, Math.round(product.price * (1 - salePercent / 100))),
                    )}
                  </span>
                </>
              ) : product.hasMultiplePrices ? (
                `From ${formatPrice(product.price)}`
              ) : (
                formatPrice(product.price)
              )}
            </p>
          ) : (
            <p className="product-card__price product-card__price--on-request">Price on Request</p>
          )}
          {product.meta && <p className="product-card__meta">{product.meta}</p>}
          {CHECKOUT_ENABLED && showActions && product.variantId && (
            <div className="product-card__actions">
              <QuickAddButton product={product} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
