"use client";

import Link from "next/link";
import type { Product } from "@/lib/ui-data";
import { formatPrice } from "@/lib/ui-data";
import { ProductImage } from "@/components/ui/ProductImage";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { OpenCartModalButton } from "./CartModal";

type ProductCardProps = {
  product: Product;
  showActions?: boolean;
  linkPrefix?: string;
};

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
        {showActions && (
          <div className="product-card__actions">
            <OpenCartModalButton className="btn btn-secondary btn--sm product-card__quick-add">
              Quick Add
            </OpenCartModalButton>
          </div>
        )}
      </div>
    </article>
  );
}
