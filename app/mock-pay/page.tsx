"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Mock payment modal — stand-in for the Razorpay Checkout popup when
 * PAYMENT_GATEWAY=mock. Reached from the checkout page. Lets dev/e2e
 * complete the full order lifecycle: success runs the real
 * /api/payment/verify path; fail runs the real payment.failed webhook path;
 * cancel leaves the order PAYMENT_PENDING (retry/sweep paths).
 */
function MockPayContent() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const gatewayOrderId = params.get("gatewayOrderId") ?? "";
  const amount = Number(params.get("amount") ?? 0);

  const [busy, setBusy] = useState<"success" | "fail" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(outcome: "success" | "fail") {
    setBusy(outcome);
    setError(null);
    try {
      const res = await fetch("/api/mock-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayOrderId, outcome }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Mock payment failed");
        return;
      }
      if (outcome === "fail") {
        router.push(`/account/orders/${data.orderId}`);
        return;
      }
      // Mirror the Razorpay success handler: browser-side verify, then confirmation.
      const verifyRes = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gatewayOrderId,
          gatewayPaymentId: data.gatewayPaymentId,
          signature: data.signature,
        }),
      });
      if (verifyRes.ok) {
        router.push(`/order-confirmation?orderId=${data.orderId}`);
      } else {
        // Webhook already posted — confirmation lands regardless.
        router.push(`/order-confirmation?orderId=${data.orderId}`);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f2ec",
        padding: 24,
      }}
    >
      <div
        data-testid="mock-pay-modal"
        style={{
          background: "#fff",
          borderRadius: 12,
          maxWidth: 400,
          width: "100%",
          padding: 32,
          boxShadow: "0 12px 40px rgba(0,0,0,.12)",
          textAlign: "center",
          fontFamily: "Georgia, serif",
        }}
      >
        <p style={{ letterSpacing: 3, fontWeight: 700, marginBottom: 4 }}>VAIRIS</p>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
          Mock Payment Gateway (test mode)
        </p>
        <p style={{ fontSize: 13, color: "#6b7280" }}>Order {orderId}</p>
        <p style={{ fontSize: 28, fontWeight: 700, margin: "8px 0 24px" }}>
          ₹{amount.toLocaleString("en-IN")}
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          <button
            type="button"
            data-testid="mock-pay-success"
            disabled={busy !== null}
            onClick={() => act("success")}
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              border: "none",
              background: "#15803d",
              color: "#fff",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {busy === "success" ? "Processing…" : "Simulate Successful Payment"}
          </button>
          <button
            type="button"
            data-testid="mock-pay-fail"
            disabled={busy !== null}
            onClick={() => act("fail")}
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid #dc2626",
              background: "#fff",
              color: "#dc2626",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {busy === "fail" ? "Processing…" : "Simulate Failed Payment"}
          </button>
          <button
            type="button"
            data-testid="mock-pay-cancel"
            disabled={busy !== null}
            onClick={() => router.push(`/account/orders/${orderId}`)}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#6b7280",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel (leave payment pending)
          </button>
        </div>

        {error && (
          <p role="alert" style={{ color: "#dc2626", fontSize: 13, marginTop: 16 }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

export default function MockPayPage() {
  return (
    <Suspense fallback={null}>
      <MockPayContent />
    </Suspense>
  );
}
