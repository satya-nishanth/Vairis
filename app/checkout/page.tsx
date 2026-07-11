"use client";

import Link from "next/link";
import Script from "next/script";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { Stepper } from "@/components/ui/Stepper";
import { OrderSummary } from "@/components/commerce/OrderSummary";
import { useCart } from "@/components/commerce/CartProvider";
import { pageLayouts } from "@/lib/layout-config";
import { formatPrice } from "@/lib/ui-data";
import { DEPOSIT_RATE } from "@/lib/orders";
import { CHECKOUT_ENABLED } from "@/lib/flags";

/**
 * Checkout — real order + gateway payment.
 *
 * Money model: customer pays 105% of the goods total; the 5% security
 * deposit is refunded after delivery (rules in lib/orders.ts).
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
};

const EMPTY_ADDRESS: AddressForm = {
  contactName: "",
  contactPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
};

type CheckoutResponse = {
  orderId: string;
  gateway: string;
  clientParams: Record<string, unknown>;
  contact: { name: string; phone: string; email: string };
};

export default function CheckoutPage() {
  const layout = pageLayouts.checkout;
  const router = useRouter();
  const { items, isLoggedIn, hydrated } = useCart();

  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupNotice, setSetupNotice] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [items],
  );
  const grandTotal = Math.round(subtotal * (1 + DEPOSIT_RATE));
  const deposit = grandTotal - subtotal;

  const set = (field: keyof AddressForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress((a) => ({ ...a, [field]: e.target.value }));

  /** Gateway-specific browser SDK launch. Add a branch per new gateway. */
  function launchGatewayCheckout(data: CheckoutResponse) {
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
    setPaying(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(address),
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
      <Container>
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
                    pattern="\d{10}"
                    title="10-digit mobile number"
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
                    required
                    pattern="\d{6}"
                    title="6-digit pincode"
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
                  <input
                    className="form-input"
                    id="co-state"
                    type="text"
                    required
                    value={address.state}
                    onChange={set("state")}
                    autoComplete="address-level1"
                  />
                </div>
              </div>
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

              <div className="deposit-explainer">
                <strong>About the 5% security deposit</strong>
                <p>
                  You pay {formatPrice(grandTotal)} today — {formatPrice(subtotal)} for your
                  jewellery plus a {formatPrice(deposit)} refundable security deposit. The
                  deposit is returned to your payment method after delivery.
                </p>
              </div>

              {setupNotice && (
                <p className="checkout-alert checkout-alert--info" role="status">
                  Online payment is being set up and will be live shortly. Your cart is saved —
                  meanwhile you can order via{" "}
                  <a href="https://wa.me/917075486464" target="_blank" rel="noopener noreferrer">
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
              { label: "Refundable deposit (5%)", value: formatPrice(deposit) },
              { label: "Shipping", value: "FREE" },
            ]}
            total={grandTotal}
            totalLabel="Payable Now"
            editCartHref="/cart"
            footer={
              <>
                <button type="submit" className="btn btn-primary btn--full" disabled={paying}>
                  {paying ? "Opening secure payment…" : `Pay ${formatPrice(grandTotal)}`}
                </button>
                <p className="summary-badges">
                  {formatPrice(deposit)} refunded after delivery · IGI · BIS · Insured
                </p>
              </>
            }
          />
        </form>
      </Container>
    </PageShell>
  );
}
