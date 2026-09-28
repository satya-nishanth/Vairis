"use client";

import Link from "next/link";
import { useState } from "react";
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
}: ProductCardProps) {
  const href = collectionSlug
    ? `${linkPrefix}/${product.slug}?collection=${encodeURIComponent(collectionSlug)}`
    : `${linkPrefix}/${product.slug}`;
  const productId = product.catalogueId ?? product.slug;
  const displayName = formatDisplayName(product.name, product.category);

  return (
    <article className="product-card">
      <div className="product-card__img-wrap">
        <Link href={href} className="product-card__img-link" tabIndex={-1} aria-hidden="true" style={{ display: "block", width: "100%", height: "100%" }}>
          {product.badge && <span className="product-card__badge">{product.badge}</span>}
          <ProductImage src={product.image} alt="" fill className="product-card__img" />
        </Link>
        <WishlistButton productId={productId} productName={displayName} />
      </div>
      <div className="product-card__body">
        <h3 className="product-card__title">
          <Link href={href}>{displayName}</Link>
        </h3>
        <p className="product-card__desc">{product.description || '\u00A0'}</p>
        <div className="product-card__footer">
          {product.price != null ? (
            <p className="product-card__price">
              {product.hasMultiplePrices ? `From ${formatPrice(product.price)}` : formatPrice(product.price)}
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
