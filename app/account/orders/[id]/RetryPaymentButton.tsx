"use client";

import Script from "next/script";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Retry payment on an existing PAYMENT_PENDING order — mirrors
 * launchGatewayCheckout() in app/checkout/page.tsx, but hits
 * /api/orders/[id]/retry-payment (reuses the stored gateway order id)
 * instead of /api/checkout (which would create a new order).
 */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type RetryResponse = {
  orderId: string;
  gateway: string;
  clientParams: Record<string, unknown>;
  contact: { name: string; phone: string; email: string };
};

export function RetryPaymentButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupNotice, setSetupNotice] = useState(false);

  function launchGatewayCheckout(data: RetryResponse) {
    if (data.gateway === "mock") {
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
      ...data.clientParams,
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
          router.refresh();
        } else {
          setError(
            "Payment received but confirmation is pending — it completes automatically. Refresh in a minute.",
          );
        }
      },
      modal: { ondismiss: () => setPaying(false) },
    });
    rzp.open();
  }

  async function handleRetry() {
    setError(null);
    setSetupNotice(false);
    setPaying(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/retry-payment`, { method: "POST" });
      const data = await res.json();

      if (res.status === 503 && data.error === "PAYMENTS_NOT_CONFIGURED") {
        setSetupNotice(true);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Could not resume payment. Please try again.");
        return;
      }

      launchGatewayCheckout(data as RetryResponse);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="confirm-card">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <h3 className="confirm-card__heading">Complete Your Payment</h3>
      <p className="checkout-note">This order is awaiting payment. Resume checkout to complete it.</p>
      <button type="button" className="btn btn-primary" onClick={handleRetry} disabled={paying}>
        {paying ? "Opening secure payment…" : "Complete Payment"}
      </button>
      {setupNotice && (
        <p className="checkout-alert checkout-alert--info" role="status">
          Online payment is being set up and will be live shortly.
        </p>
      )}
      {error && (
        <p className="checkout-alert checkout-alert--error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
