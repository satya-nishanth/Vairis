"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/ui-data";
import { ProductImage } from "@/components/ui/ProductImage";

export type CartLineItem = {
  id: string;
  slug: string;
  name: string;
  image: string;
  meta: string;
  quantity: number;
  unitPrice: number;
};

type CartItemProps = {
  item: CartLineItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
};

export function CartItem({ item, onIncrement, onDecrement, onRemove }: CartItemProps) {
  return (
    <article className="cart-item">
      <ProductImage src={item.image} alt={item.name} width={140} height={140} className="cart-item__img" />
      <div>
        <h2 className="cart-item__title">
          <Link href={`/product/${item.slug}`}>{item.name}</Link>
        </h2>
        <p className="cart-item__meta">{item.meta}</p>

        <div className="cart-item__qty">
          <button type="button" aria-label="Decrease quantity" onClick={onDecrement}>
            −
          </button>
          <span>{item.quantity}</span>
          <button type="button" aria-label="Increase quantity" onClick={onIncrement}>
            +
          </button>
        </div>

        <div className="cart-item__actions">
          <button type="button" onClick={onRemove}>
            ✕ Remove
          </button>
        </div>

        <p className="cart-item__note">Insured Delivery · Easy Returns · Secure Packaging</p>
      </div>
      <p className="cart-item__price">{formatPrice(item.unitPrice * item.quantity)}</p>
    </article>
  );
}
