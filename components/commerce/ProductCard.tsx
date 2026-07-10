"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/ui-data";
import { formatPrice } from "@/lib/ui-data";
import { ProductImage } from "@/components/ui/ProductImage";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { useCart } from "@/components/commerce/CartProvider";
import { useCartModal } from "./CartModal";

type ProductCardProps = {
  product: Product;
  showActions?: boolean;
  linkPrefix?: string;
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
      router.push(`/auth/login?next=/product/${product.slug}`);
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

export function ProductCard({ product, showActions = true, linkPrefix = "/product" }: ProductCardProps) {
  const href = `${linkPrefix}/${product.slug}`;
  const productId = product.catalogueId ?? product.slug;

  return (
    <article className="product-card">
      <Link href={href} className="product-card__img-wrap">
        {product.badge && <span className="product-card__badge">{product.badge}</span>}
        <ProductImage src={product.image} alt={product.name} fill className="product-card__img" />
        <WishlistButton productId={productId} productName={product.name} />
      </Link>
      <div className="product-card__body">
        <h3 className="product-card__title">
          <Link href={href}>{product.name}</Link>
        </h3>
        {product.description && <p className="product-card__desc">{product.description}</p>}
        {product.price != null && <p className="product-card__price">{formatPrice(product.price)}</p>}
        {product.meta && <p className="product-card__meta">{product.meta}</p>}
        {showActions && product.variantId && (
          <div className="product-card__actions">
            <QuickAddButton product={product} />
          </div>
        )}
      </div>
    </article>
  );
}
