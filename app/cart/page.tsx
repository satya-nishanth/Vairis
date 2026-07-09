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

const METAL_LABELS: Record<string, string> = {
  GOLD_18K: "18kt Yellow Gold",
  GOLD_14K: "14kt Yellow Gold",
  ROSE_GOLD: "Rose Gold 18kt",
};

const breadcrumbs = [{ label: "Home", href: "/" }, { label: "Your Cart" }];

export default function CartPage() {
  const layout = pageLayouts.cart;
  const { items, count, isLoggedIn, hydrated, updateQuantity, removeItem } = useCart();

  if (!hydrated) {
    return (
      <PageShell {...layout} breadcrumbs={breadcrumbs}>
        <Container>
          <p style={{ padding: "48px 0" }}>Loading your cart…</p>
        </Container>
      </PageShell>
    );
  }

  if (!isLoggedIn) {
    return (
      <PageShell {...layout} breadcrumbs={breadcrumbs}>
        <Container>
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <h1 style={{ fontSize: "2rem", marginBottom: 16 }}>Your Cart</h1>
            <p style={{ marginBottom: 24 }}>Sign in to view your cart.</p>
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
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <h1 style={{ fontSize: "2rem", marginBottom: 16 }}>Your Cart is Empty</h1>
            <p style={{ marginBottom: 24 }}>Browse our collections and add something you love.</p>
            <Link href="/all-products/rings" className="btn btn-primary">
              Shop Now
            </Link>
          </div>
        </Container>
      </PageShell>
    );
  }

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <PageShell {...layout} breadcrumbs={breadcrumbs}>
      <Container>
        <h1 style={{ fontSize: "2rem", marginBottom: 8 }}>
          Your Cart ({count} {count === 1 ? "Item" : "Items"})
        </h1>
        <p style={{ marginBottom: 32 }}>Insured delivery on every order.</p>

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
                  }${item.variant.size ? ` · ${item.variant.size}` : ""}`,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                }}
                onIncrement={() => updateQuantity(item.id, item.quantity + 1)}
                onDecrement={() => {
                  if (item.quantity <= 1) removeItem(item.id);
                  else updateQuantity(item.id, item.quantity - 1);
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
                <details style={{ margin: "16px 0", fontSize: "0.8125rem" }}>
                  <summary>Why are Vairis prices lower?</summary>
                  <p style={{ marginTop: 8 }}>We sell direct without showroom overheads.</p>
                </details>
                <SecureCheckoutButton />
                <p style={{ fontSize: "0.75rem", textAlign: "center", marginTop: 16 }}>
                  IGI · BIS Hallmarked · Insured · Secure
                </p>
              </>
            }
          />
        </div>
      </Container>
      <MobileCheckoutBar total={subtotal} href="/checkout" label="Proceed to Checkout" />
    </PageShell>
  );
}
