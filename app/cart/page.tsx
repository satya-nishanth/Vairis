"use client";

import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { CartItem } from "@/components/commerce/CartItem";
import { OrderSummary, SecureCheckoutButton } from "@/components/commerce/OrderSummary";
import { MobileCheckoutBar } from "@/components/commerce/MobileCheckoutBar";
import { useCart } from "@/components/commerce/CartProvider";
import { pageLayouts } from "@/lib/layout-config";
import { formatPrice } from "@/lib/ui-data";
import { CHECKOUT_ENABLED } from "@/lib/flags";

const METAL_LABELS: Record<string, string> = {
  GOLD_18K: "18kt Yellow Gold",
  GOLD_14K: "14kt Yellow Gold",
  ROSE_GOLD: "Rose Gold 18kt",
};

const breadcrumbs = [{ label: "Home", href: "/" }, { label: "Your Cart" }];

export default function CartPage() {
  const layout = pageLayouts.cart;
  const { items, count, isLoggedIn, hydrated, updateQuantity, removeItem } = useCart();

  // WhatsApp-enquiry mode: cart is disabled until Razorpay is live
  if (!CHECKOUT_ENABLED) {
    return (
      <PageShell {...layout} breadcrumbs={breadcrumbs}>
        <Container>
          <div className="cart-state">
            <h1>Ordering via WhatsApp</h1>
            <p>
              Online checkout is launching soon. Message us on WhatsApp to order any piece —
              we&apos;ll confirm your order and you can track it right here under My Orders.
            </p>
            <a
              href="https://wa.me/917075486464"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Order on WhatsApp
            </a>
          </div>
        </Container>
      </PageShell>
    );
  }

  if (!hydrated) {
    return (
      <PageShell {...layout} breadcrumbs={breadcrumbs}>
        <Container>
          <div className="cart-state">
            <p>Loading your cart…</p>
          </div>
        </Container>
      </PageShell>
    );
  }

  if (!isLoggedIn) {
    return (
      <PageShell {...layout} breadcrumbs={breadcrumbs}>
        <Container>
          <div className="cart-state">
            <h1>Your Cart</h1>
            <p>Sign in to view your cart.</p>
            <Link href="/auth/login?next=/cart" className="btn btn-primary">
              Sign In
            </Link>
          </div>
        </Container>
      </PageShell>
    );
  }

  if (items.length === 0) {
    return (
      <PageShell {...layout} breadcrumbs={breadcrumbs}>
        <Container>
          <div className="cart-state">
            <h1>Your Cart is Empty</h1>
            <p>Browse our collections and add something you love.</p>
            <Link href="/all-products/rings" className="btn btn-primary">
              Shop Now
            </Link>
          </div>
        </Container>
      </PageShell>
    );
  }

  const subtotal = items.reduce(
    (sum, i) => sum + (i.unitPrice != null ? i.unitPrice * i.quantity : 0),
    0,
  );
  const hasUnpriced = items.some((i) => i.unitPrice == null);

  return (
    <PageShell {...layout} breadcrumbs={breadcrumbs}>
      <Container>
        <h1 className="cart-page__title">
          Your Cart ({count} {count === 1 ? "Item" : "Items"})
        </h1>
        <p className="cart-page__lead">Insured delivery on every order.</p>
        {hasUnpriced && (
          <p role="alert" className="cart-page__lead" style={{ color: "var(--color-danger, #b91c1c)" }}>
            One or more items could not be priced. Remove them or enquire on WhatsApp before checkout.
          </p>
        )}

        <div className="cart-layout">
          <div>
            {items.map((item) => (
              <CartItem
                key={item.id}
                item={{
                  id: item.id,
                  slug: item.variant.product.id,
                  name: item.variant.product.name,
                  image: item.variant.product.images[0] ?? "",
                  meta: `${item.variant.product.itemCode ?? item.variant.sku} · ${
                    METAL_LABELS[item.variant.metalType] ?? item.variant.metalType
                  }${item.variant.size ? ` · Size ${item.variant.size}` : ""}${
                    item.withExchange ? " · With Exchange" : ""
                  }${item.priceError ? ` · ${item.priceError}` : ""}`,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice ?? 0,
                  priceUnavailable: item.unitPrice == null,
                }}
                onIncrement={() => updateQuantity(item.id, item.quantity + 1)}
                onDecrement={() => {
                  if (item.quantity > 1) {
                    updateQuantity(item.id, item.quantity - 1);
                  }
                }}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>

          <OrderSummary
            lines={[
              { label: "Subtotal", value: formatPrice(subtotal) },
              { label: "Making Charges", value: "Included" },
              { label: "Shipping", value: "FREE" },
              { label: "GST", value: "Included" },
            ]}
            total={subtotal}
            showEmi
            footer={
              <>
                <details className="summary-why">
                  <summary>Why are Vairis prices lower?</summary>
                  <p>We sell direct without showroom overheads.</p>
                </details>
                <SecureCheckoutButton />
                <p className="summary-badges">IGI · BIS Hallmarked · Insured · Secure</p>
              </>
            }
          />
        </div>
      </Container>
      <MobileCheckoutBar total={subtotal} href="/checkout" label="Proceed to Checkout" />
    </PageShell>
  );
}
