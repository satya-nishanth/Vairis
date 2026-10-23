"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { CartItem } from "@/components/commerce/CartItem";
import { OrderSummary, SecureCheckoutButton } from "@/components/commerce/OrderSummary";
import { MobileCheckoutBar } from "@/components/commerce/MobileCheckoutBar";
import {
  discountSummaryLines,
  useDiscountPreview,
} from "@/components/commerce/CartDiscountPanel";
import { useCart } from "@/components/commerce/CartProvider";
import { pageLayouts } from "@/lib/layout-config";
import { formatPrice, WHATSAPP_URL } from "@/lib/ui-data";
import { CHECKOUT_ENABLED } from "@/lib/flags";
import { formatMetalLabel } from "@/lib/metal";
import { readAppliedPromo, writeAppliedPromo } from "@/lib/applied-promo";

const breadcrumbs = [{ label: "Home", href: "/" }, { label: "Your Cart" }];

export default function CartPage() {
  const layout = pageLayouts.cart;
  const { items, count, isLoggedIn, hydrated, updateQuantity, removeItem } = useCart();

  const [promoInput, setPromoInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  useEffect(() => {
    const stored = readAppliedPromo();
    if (stored) {
      setAppliedCode(stored);
      setPromoInput(stored);
    }
  }, []);

  const refreshKey = useMemo(
    () => items.map((i) => `${i.id}:${i.quantity}`).join("|"),
    [items],
  );
  const { preview, busy: previewBusy, reload } = useDiscountPreview(
    refreshKey,
    appliedCode,
  );

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
              href={WHATSAPP_URL}
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
  const payable = preview?.payable ?? Math.max(0, subtotal - (preview?.discountAmount ?? 0));
  const discountLines = discountSummaryLines(preview?.automatic, preview?.coupon);

  async function applyPromo() {
    setPromoBusy(true);
    setPromoError(null);
    const code = promoInput.trim().toUpperCase();
    setAppliedCode(code);
    // reload with new code
    const res = await fetch("/api/discounts/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promoCode: code }),
    });
    const data = await res.json();
    setPromoBusy(false);
    if (!res.ok) {
      setPromoError(data.error ?? "Invalid code");
      setAppliedCode(null);
      writeAppliedPromo(null);
      await reload();
      return;
    }
    if (!data.coupon || data.coupon.amount <= 0) {
      setPromoError("This code does not apply to your cart");
      setAppliedCode(null);
      writeAppliedPromo(null);
      await reload();
      return;
    }
    writeAppliedPromo(code);
  }

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
                  meta: `${item.variant.product.itemCode ?? item.variant.sku} · ${formatMetalLabel(
                    item.variant.metalType,
                    item.variant.metalColor,
                  )}${item.variant.size ? ` · Size ${item.variant.size}` : ""}${
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
              { label: "Subtotal (incl. GST)", value: formatPrice(subtotal) },
              ...discountLines,
              { label: "Making Charges", value: "Included" },
              { label: "Shipping", value: "FREE" },
            ]}
            total={payable}
            totalLabel="Payable"
            showEmi
            footer={
              <>
                <div className="promo-field" style={{ marginBottom: 12 }}>
                  <input
                    type="text"
                    placeholder="Apply code"
                    value={promoInput}
                    onChange={(e) =>
                      setPromoInput(e.target.value.toUpperCase().slice(0, 40))
                    }
                    maxLength={40}
                    disabled={!!appliedCode}
                    style={{ textTransform: "uppercase" }}
                  />
                  {appliedCode ? (
                    <button
                      type="button"
                      onClick={async () => {
                        setAppliedCode(null);
                        setPromoInput("");
                        setPromoError(null);
                        writeAppliedPromo(null);
                      }}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={applyPromo}
                      disabled={promoBusy || promoInput.trim().length < 3}
                    >
                      {promoBusy ? "…" : "Apply"}
                    </button>
                  )}
                </div>
                {promoError && (
                  <p style={{ fontSize: "0.75rem", color: "#b91c1c", marginBottom: 8 }}>{promoError}</p>
                )}
                {previewBusy && !preview && (
                  <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 8 }}>
                    Updating savings…
                  </p>
                )}
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
      <MobileCheckoutBar total={payable} href="/checkout" label="Proceed to Checkout" />
    </PageShell>
  );
}
