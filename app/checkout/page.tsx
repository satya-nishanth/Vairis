"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { Stepper } from "@/components/ui/Stepper";
import { OrderSummary } from "@/components/commerce/OrderSummary";
import { useCart } from "@/components/commerce/CartProvider";
import { pageLayouts } from "@/lib/layout-config";
import { formatPrice, WHATSAPP_URL } from "@/lib/ui-data";
import { CHECKOUT_ENABLED } from "@/lib/flags";
import { track } from "@/lib/analytics-client";
import { formatMetalLabel } from "@/lib/metal";
import { couponKindSuffix } from "@/lib/promo-labels";
import { readAppliedPromo, writeAppliedPromo } from "@/lib/applied-promo";
import type { PromoKind } from "@prisma/client";

/**
 * Checkout — real order + gateway payment.
 *
 * Money model: customer pays exactly the displayed total
 * (wastage + 3% GST, computed server-side per line).
 *
 * The server decides the gateway (lib/payments); this page receives
 * `{ gateway, clientParams }` from /api/checkout and hands clientParams to
 * the matching browser SDK. Today that's Razorpay Checkout JS — a second
 * gateway would add its own branch in launchGatewayCheckout().
 *
 * NOT YET CONFIGURED: while gateway keys are missing, /api/checkout
 * returns 503 and this page shows the "payment setup in progress" notice
 * instead of the Razorpay modal. Everything else works.
 */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type AddressForm = {
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const EMPTY_ADDRESS: AddressForm = {
  contactName: "",
  contactPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  country: "IN",
};

type CheckoutResponse = {
  orderId: string;
  gateway: string;
  clientParams: Record<string, unknown>;
  contact: { name: string; phone: string; email: string };
};

type SavedAddress = {
  id: string;
  label: string | null;
  contactName: string;
  contactPhone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
};

export default function CheckoutPage() {
  const layout = pageLayouts.checkout;
  const router = useRouter();
  const { items, isLoggedIn, hydrated, refresh: refreshCart } = useCart();

  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupNotice, setSetupNotice] = useState(false);

  // Saved addresses (address book)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new">("new");
  const [saveAddress, setSaveAddress] = useState(true);

  // Promo code + automatic discount preview (separate legs)
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{
    code: string;
    discount: number;
    percent?: number;
    kind?: PromoKind;
  } | null>(null);
  const [automatic, setAutomatic] = useState<{
    name: string;
    amount: number;
    percent: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoHydrated, setPromoHydrated] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + (i.unitPrice != null ? i.unitPrice * i.quantity : 0), 0),
    [items],
  );
  const hasUnpriced = items.some((i) => i.unitPrice == null);
  const discount = (automatic?.amount ?? 0) + (promo?.discount ?? 0);
  const grandTotal = Math.max(0, Math.round(subtotal - discount));

  const refreshKey = useMemo(
    () => items.map((i) => `${i.id}:${i.quantity}`).join("|"),
    [items],
  );

  // Restore cart-applied promo once, then keep auto + coupon in sync with cart.
  useEffect(() => {
    if (!promoHydrated) {
      const stored = readAppliedPromo();
      if (stored) setPromoInput(stored);
      setPromoHydrated(true);
      return;
    }
    if (!isLoggedIn || items.length === 0) return;
    let cancelled = false;
    const code = promo?.code ?? readAppliedPromo();
    fetch("/api/discounts/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promoCode: code }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok || data.error) {
          // Keep last auto/coupon on rate-limit; otherwise drop failed restore.
          if (r.status !== 429 && code && !promo?.code) {
            writeAppliedPromo(null);
            setPromoInput("");
          }
          return;
        }
        setAutomatic(
          data.automatic && data.automatic.amount > 0
            ? {
                name: data.automatic.name,
                amount: data.automatic.amount,
                percent: data.automatic.percent,
              }
            : null,
        );
        if (code && data.coupon && data.coupon.amount > 0) {
          setPromo({
            code: data.coupon.code,
            discount: data.coupon.amount,
            percent: data.coupon.percent,
            kind: data.coupon.kind,
          });
          setPromoInput(data.coupon.code);
          writeAppliedPromo(data.coupon.code);
        } else if (code) {
          writeAppliedPromo(null);
          setPromo(null);
          setPromoInput("");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // promo?.code intentionally omitted — restore uses sessionStorage; applyPromo sets promo.
     
  }, [isLoggedIn, refreshKey, promoHydrated, items.length]);

  const set = (field: keyof AddressForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress((a) => ({ ...a, [field]: e.target.value }));

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/account/addresses")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: SavedAddress[]) => {
        setSavedAddresses(rows);
        const def = rows.find((a) => a.isDefault) ?? rows[0];
        if (def) selectSaved(def);
      })
      .catch(() => {});
     
  }, [isLoggedIn]);

  function selectSaved(a: SavedAddress) {
    setSelectedAddressId(a.id);
    setAddress({
      contactName: a.contactName,
      contactPhone: a.contactPhone,
      addressLine1: a.line1,
      addressLine2: a.line2 ?? "",
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      country: a.country,
    });
  }

  function selectNew() {
    setSelectedAddressId("new");
    setAddress(EMPTY_ADDRESS);
  }

  async function applyPromo() {
    setPromoBusy(true);
    setPromoError(null);
    try {
      const res = await fetch("/api/discounts/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoCode: promoInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data.error ?? "Invalid code");
        setPromo(null);
        writeAppliedPromo(null);
        return;
      }
      setAutomatic(
        data.automatic && data.automatic.amount > 0
          ? {
              name: data.automatic.name,
              amount: data.automatic.amount,
              percent: data.automatic.percent,
            }
          : null,
      );
      if (!data.coupon || data.coupon.amount <= 0) {
        setPromoError("This code does not apply to your cart");
        setPromo(null);
        writeAppliedPromo(null);
        return;
      }
      setPromo({
        code: data.coupon.code,
        discount: data.coupon.amount,
        percent: data.coupon.percent,
        kind: data.coupon.kind,
      });
      writeAppliedPromo(data.coupon.code);
    } catch {
      setPromoError("Could not validate the code. Try again.");
    } finally {
      setPromoBusy(false);
    }
  }

  /** Gateway-specific browser SDK launch. Add a branch per new gateway. */
  function launchGatewayCheckout(data: CheckoutResponse) {
    if (data.gateway === "mock") {
      // Mock gateway (dev/e2e): its "modal" is our own page.
      const p = data.clientParams as { gatewayOrderId?: string; amount?: number };
      router.push(
        `/mock-pay?orderId=${encodeURIComponent(data.orderId)}&gatewayOrderId=${encodeURIComponent(
          p.gatewayOrderId ?? "",
        )}&amount=${encodeURIComponent(String(p.amount ?? 0))}`,
      );
      return;
    }
    if (data.gateway !== "razorpay") {
      setError(`Unsupported payment gateway "${data.gateway}" in browser — update checkout page.`);
      return;
    }
    if (!window.Razorpay) {
      setError("Payment library failed to load. Check your connection and retry.");
      return;
    }
    const rzp = new window.Razorpay({
      ...data.clientParams, // key, order_id, amount, currency — from the adapter
      name: "VAIRIS",
      description: `Order ${data.orderId}`,
      prefill: {
        name: data.contact.name,
        contact: data.contact.phone,
        email: data.contact.email,
      },
      theme: { color: "#5e684e" },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        // Browser-side confirmation; the payment.captured webhook is the
        // server-side backstop if this request never lands.
        const verifyRes = await fetch("/api/payment/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gatewayOrderId: response.razorpay_order_id,
            gatewayPaymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          }),
        });
        if (verifyRes.ok) {
          await refreshCart();
          router.push(`/order-confirmation?orderId=${data.orderId}`);
        } else {
          setError(
            "Payment received but confirmation is pending — it completes automatically. Check My Orders in a minute.",
          );
        }
      },
      modal: { ondismiss: () => setPaying(false) },
    });
    rzp.open();
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSetupNotice(false);
    if (hasUnpriced) {
      setError("One or more cart items could not be priced. Return to cart and remove them, or enquire on WhatsApp.");
      return;
    }
    setPaying(true);
    track("begin_checkout", { meta: { value: grandTotal, items: items.length } });

    try {
      // Save a newly-typed address to the address book (best-effort).
      if (selectedAddressId === "new" && saveAddress && address.addressLine1) {
        fetch("/api/account/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactName: address.contactName,
            contactPhone: address.contactPhone,
            line1: address.addressLine1,
            line2: address.addressLine2 || undefined,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            country: address.country,
          }),
        }).catch(() => {});
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...address, promoCode: promo?.code }),
      });
      const data = await res.json();

      if (res.status === 503 && data.error === "PAYMENTS_NOT_CONFIGURED") {
        // Gateway keys not in env yet — expected during setup phase.
        setSetupNotice(true);
        return;
      }
      if (!res.ok) {
        setError(data.message ?? "Could not start payment. Please try again.");
        return;
      }

      launchGatewayCheckout(data as CheckoutResponse);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  // WhatsApp-enquiry mode: checkout disabled until Razorpay is live
  if (!CHECKOUT_ENABLED) {
    return (
      <PageShell {...layout}>
        <Container>
          <div className="cart-state">
            <h1>Ordering via WhatsApp</h1>
            <p>Online checkout is launching soon — message us to place your order.</p>
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
      <PageShell {...layout}>
        <Container>
          <div className="cart-state">
            <p>Loading checkout…</p>
          </div>
        </Container>
      </PageShell>
    );
  }

  if (!isLoggedIn) {
    return (
      <PageShell {...layout}>
        <Container>
          <div className="cart-state">
            <h1>Checkout</h1>
            <p>Sign in to complete your purchase.</p>
            <Link href="/auth/login?next=/checkout" className="btn btn-primary">
              Sign In
            </Link>
          </div>
        </Container>
      </PageShell>
    );
  }

  if (items.length === 0) {
    return (
      <PageShell {...layout}>
        <Container>
          <div className="cart-state">
            <h1>Nothing to Check Out</h1>
            <p>Your cart is empty.</p>
            <Link href="/all-products/rings" className="btn btn-primary">
              Shop Now
            </Link>
          </div>
        </Container>
      </PageShell>
    );
  }

  return (
    <PageShell {...layout}>
      {/* Razorpay Checkout JS — the active gateway's browser SDK.
          launchGatewayCheckout guards on window.Razorpay before use. */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <main>
        <Container>
          <h1 className="checkout-title" style={{ fontSize: "1.75rem", fontWeight: 600, margin: "24px 0 16px" }}>
            Checkout
          </h1>
          <Stepper
            steps={[
              { label: "Cart", state: "done" },
              { label: "Delivery", state: "active", number: "2" },
              { label: "Payment", state: "upcoming", number: "3" },
              { label: "Confirmation", state: "upcoming", number: "4" },
            ]}
          />

        <form className="checkout-layout" onSubmit={handlePay}>
          <div>
            <section className="checkout-section">
              <h2 className="checkout-section__title">
                <span className="checkout-section__num">1</span> Delivery Address
              </h2>

              {savedAddresses.length > 0 && (
                <div className="form-group" data-testid="address-book">
                  <label>Saved Addresses</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {savedAddresses.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={`btn ${selectedAddressId === a.id ? "btn-primary" : "btn-secondary"}`}
                        aria-pressed={selectedAddressId === a.id}
                        onClick={() => selectSaved(a)}
                      >
                        {a.label || `${a.city} · ${a.pincode}`}
                        {a.isDefault ? " ★" : ""}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`btn ${selectedAddressId === "new" ? "btn-primary" : "btn-secondary"}`}
                      aria-pressed={selectedAddressId === "new"}
                      onClick={selectNew}
                    >
                      + New Address
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                <label>
                  <input
                    type="radio"
                    name="co-country-mode"
                    checked={address.country === "IN"}
                    onChange={() => setAddress((a) => ({ ...a, country: "IN" }))}
                  />{" "}
                  India
                </label>
                <label>
                  <input
                    type="radio"
                    name="co-country-mode"
                    checked={address.country !== "IN"}
                    onChange={() => setAddress((a) => ({ ...a, country: a.country === "IN" ? "" : a.country }))}
                  />{" "}
                  International
                </label>
              </div>
              {address.country !== "IN" && (
                <div className="form-group">
                  <label htmlFor="co-country">Country</label>
                  <input
                    className="form-input"
                    id="co-country"
                    type="text"
                    required
                    minLength={2}
                    value={address.country}
                    onChange={set("country")}
                    autoComplete="country-name"
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="co-name">Full Name</label>
                <input
                  className="form-input"
                  id="co-name"
                  type="text"
                  required
                  minLength={2}
                  value={address.contactName}
                  onChange={set("contactName")}
                  autoComplete="name"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="co-phone">Mobile Number</label>
                  <input
                    className="form-input"
                    id="co-phone"
                    type="tel"
                    required
                    pattern={address.country === "IN" ? "\\d{10}" : undefined}
                    title={address.country === "IN" ? "10-digit mobile number" : undefined}
                    value={address.contactPhone}
                    onChange={set("contactPhone")}
                    autoComplete="tel-national"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="co-pin">Pincode</label>
                  <input
                    className="form-input"
                    id="co-pin"
                    type="text"
                    inputMode="numeric"
                    required
                    pattern={address.country === "IN" ? "\\d{6}" : undefined}
                    title={address.country === "IN" ? "6-digit pincode" : undefined}
                    value={address.pincode}
                    onChange={set("pincode")}
                    autoComplete="postal-code"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="co-addr1">Address</label>
                <input
                  className="form-input"
                  id="co-addr1"
                  type="text"
                  required
                  minLength={5}
                  value={address.addressLine1}
                  onChange={set("addressLine1")}
                  autoComplete="address-line1"
                />
              </div>
              <div className="form-group">
                <label htmlFor="co-addr2">
                  Apartment, landmark <span className="form-group__optional">(optional)</span>
                </label>
                <input
                  className="form-input"
                  id="co-addr2"
                  type="text"
                  value={address.addressLine2}
                  onChange={set("addressLine2")}
                  autoComplete="address-line2"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="co-city">City</label>
                  <input
                    className="form-input"
                    id="co-city"
                    type="text"
                    required
                    value={address.city}
                    onChange={set("city")}
                    autoComplete="address-level2"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="co-state">State</label>
                  {address.country === "IN" ? (
                    <select
                      className="form-input"
                      id="co-state"
                      required
                      value={address.state}
                      onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
                      autoComplete="address-level1"
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="form-input"
                      id="co-state"
                      type="text"
                      required
                      value={address.state}
                      onChange={set("state")}
                      autoComplete="address-level1"
                    />
                  )}
                </div>
              </div>
              {selectedAddressId === "new" && isLoggedIn && (
                <label className="checkout-note" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                  />
                  Save this address for next time
                </label>
              )}
              <p className="checkout-note">
                🛡 Your jewellery delivery is fully insured and OTP protected.
              </p>
            </section>

            <section className="checkout-section">
              <h2 className="checkout-section__title">
                <span className="checkout-section__num">2</span> Shipping Method
              </h2>
              {/* Delivery partner not decided yet (lib/shipping) — flat promise,
                  no courier selection until a provider is integrated. */}
              <div className="shipping-card">
                <div>
                  <strong>Insured Delivery</strong>
                  <br />
                  <span className="checkout-note">
                    Tamper-proof packaging · tracking details shared after dispatch
                  </span>
                </div>
                <strong>FREE</strong>
              </div>
            </section>

            <section className="checkout-section">
              <h2 className="checkout-section__title">
                <span className="checkout-section__num">3</span> Payment
              </h2>
              <label className="payment-option is-selected">
                <input type="radio" name="pay" defaultChecked readOnly />{" "}
                <div>
                  <strong>UPI / Cards / Netbanking</strong>{" "}
                  <span className="payment-option__badge">Secured by Razorpay</span>
                </div>
              </label>

              <div className="form-group" style={{ marginTop: 16 }} data-testid="promo-box">
                <label htmlFor="co-promo">Promo Code</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="form-input"
                    id="co-promo"
                    type="text"
                    placeholder="Enter code"
                    value={promoInput}
                    onChange={(e) => {
                      setPromoInput(e.target.value.toUpperCase().slice(0, 40));
                      setPromoError(null);
                    }}
                    maxLength={40}
                    disabled={promo != null}
                    style={{ textTransform: "uppercase" }}
                  />
                  {promo ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setPromo(null);
                        setPromoInput("");
                        writeAppliedPromo(null);
                      }}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={applyPromo}
                      disabled={promoBusy || promoInput.trim().length < 3}
                    >
                      {promoBusy ? "Checking…" : "Apply"}
                    </button>
                  )}
                </div>
                {promo && (
                  <p className="checkout-note" role="status">
                    ✓ {promo.code} applied
                    {couponKindSuffix(promo.kind, promo.percent)}{" "}
                    — {formatPrice(promo.discount)}
                  </p>
                )}
                {automatic && (
                  <p className="checkout-note" role="status">
                    Automatic discount {automatic.name} · {automatic.percent}% —{" "}
                    {formatPrice(automatic.amount)}
                  </p>
                )}
                {promoError && (
                  <p className="checkout-alert checkout-alert--error" role="alert">
                    {promoError}
                  </p>
                )}
              </div>

              {setupNotice && (
                <p className="checkout-alert checkout-alert--info" role="status">
                  Online payment is being set up and will be live shortly. Your cart is saved —
                  meanwhile you can order via{" "}
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                  .
                </p>
              )}
              {error && (
                <p className="checkout-alert checkout-alert--error" role="alert">
                  {error}
                </p>
              )}
            </section>
          </div>

          <OrderSummary
            lines={[
              { label: "Subtotal (incl. GST)", value: formatPrice(subtotal) },
              ...(automatic && automatic.amount > 0
                ? [
                    {
                      label: `Discount (${automatic.name} · ${automatic.percent}%)`,
                      value: `− ${formatPrice(automatic.amount)}`,
                    },
                  ]
                : []),
              ...(promo && promo.discount > 0
                ? [
                    {
                      label: `Coupon (${promo.code}${couponKindSuffix(promo.kind, promo.percent)})`,
                      value: `− ${formatPrice(promo.discount)}`,
                    },
                  ]
                : []),
              { label: "Shipping", value: "FREE" },
            ]}
            total={grandTotal}
            totalLabel="Payable Now"
            editCartHref="/cart"
            footer={
              <>
                <button type="submit" className="btn btn-primary btn--full" disabled={paying || hasUnpriced}>
                  {paying ? "Opening secure payment…" : `Pay ${formatPrice(grandTotal)}`}
                </button>
                <p className="summary-badges">IGI · BIS Hallmarked · Insured Delivery</p>
              </>
            }
          >
            {items.length > 0 && (
              <div
                className="checkout-items-preview"
                style={{
                  borderBottom: "1px solid var(--color-border-light)",
                  paddingBottom: "12px",
                  marginBottom: "16px",
                  maxHeight: "240px",
                  overflowY: "auto",
                }}
              >
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      gap: "12px",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    {item.variant?.product?.images?.[0] ? (
                      <img
                        src={item.variant.product.images[0]}
                        alt={item.variant.product.name}
                        style={{
                          width: "48px",
                          height: "48px",
                          objectFit: "cover",
                          borderRadius: "4px",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          background: "var(--color-bg-alt)",
                          borderRadius: "4px",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.variant?.product?.name || "Jewellery piece"}
                      </p>
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--color-text-muted)",
                          margin: "2px 0 0",
                        }}
                      >
                        {[
                          item.variant?.metalType
                            ? formatMetalLabel(
                                item.variant.metalType,
                                item.variant.metalColor,
                              )
                            : null,
                          item.variant?.size ? `Size ${item.variant.size}` : null,
                          `Qty: ${item.quantity}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.unitPrice != null
                        ? formatPrice(item.unitPrice * item.quantity)
                        : "Unavailable"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </OrderSummary>
        </form>
      </Container>
    </main>
  </PageShell>
  );
}
