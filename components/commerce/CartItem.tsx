import Link from "next/link";
import { formatPrice } from "@/lib/ui-data";
import { ProductImage } from "@/components/ui/ProductImage";
import { Button } from "@/components/ui/Button";

export type CartLineItem = {
  slug?: string;
  name: string;
  image: string;
  meta: string;
  tags?: string[];
  price: number;
  showOptions?: boolean;
};

type CartItemProps = {
  item: CartLineItem;
};

export function CartItem({ item }: CartItemProps) {
  return (
    <article className="cart-item">
      <ProductImage src={item.image} alt={item.name} width={140} height={140} className="cart-item__img" />
      <div>
        <h2 className="cart-item__title">
          {item.slug ? <Link href={`/product/${item.slug}`}>{item.name}</Link> : item.name}
        </h2>
        <p className="cart-item__meta">{item.meta}</p>
        {item.tags && item.tags.length > 0 && (
          <div className="cart-item__tags">
            {item.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}
        {item.showOptions && (
          <div className="form-row" style={{ maxWidth: 280, marginTop: 12 }}>
            <select className="form-input" aria-label="Metal">
              <option>18K Yellow Gold</option>
            </select>
            <div className="qty" style={{ display: "inline-flex", border: "1px solid var(--color-border)", borderRadius: 4 }}>
              <button type="button">−</button>
              <span style={{ padding: "8px 12px" }}>1</span>
              <button type="button">+</button>
            </div>
          </div>
        )}
        <div className="cart-item__actions">
          <button type="button">✕ Remove</button>
          <button type="button">♡ Save for Later</button>
        </div>
        {item.showOptions && (
          <p style={{ fontSize: "0.75rem", marginTop: 12 }}>Insured Delivery · Easy Returns · Secure Packaging</p>
        )}
      </div>
      <p className="cart-item__price">{formatPrice(item.price)}</p>
    </article>
  );
}

type UpsellItem = {
  name: string;
  image: string;
  price: number;
};

export function UpsellCard({ name, image, price }: UpsellItem) {
  return (
    <div className="upsell-card">
      <ProductImage src={image} alt={name} width={80} height={80} />
      <p>{name}</p>
      <p className="product-card__price">{formatPrice(price)}</p>
      <Button variant="secondary" size="sm">
        Add +
      </Button>
    </div>
  );
}

export function FoundersBanner({ image, quote, subtext }: { image: string; quote: string; subtext: string }) {
  return (
    <div className="founders-banner">
      <ProductImage src={image} alt="Founders" width={200} height={133} />
      <div>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.125rem", color: "var(--color-text)", marginBottom: 16 }}>
          &ldquo;{quote}&rdquo;
        </p>
        <p style={{ fontSize: "0.8125rem" }}>{subtext}</p>
      </div>
    </div>
  );
}
