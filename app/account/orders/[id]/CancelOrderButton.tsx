"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Customer self-serve cancellation — allowed pre-dispatch only
 * (PAYMENT_PENDING / PAYMENT_CONFIRMED / PREPARING); hits
 * /api/orders/[id]/cancel. Paid orders get an automatic full refund.
 */
export function CancelOrderButton({ orderId, paid }: { orderId: string; paid: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (reason.trim().length < 3) {
      setError("Tell us briefly why you're cancelling.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not cancel the order. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="confirm-card" data-testid="cancel-order">
      <h3 className="confirm-card__heading">Changed Your Mind?</h3>
      {!open ? (
        <>
          <p className="checkout-note">
            You can cancel this order until it is dispatched.
            {paid ? " Your full payment is refunded automatically." : ""}
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
            Cancel Order
          </button>
        </>
      ) : (
        <>
          <label className="checkout-note" htmlFor="cancel-reason">
            Why are you cancelling?
          </label>
          <textarea
            id="cancel-reason"
            className="form-input"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Ordered the wrong size"
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Cancelling…" : "Confirm Cancellation"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Keep Order
            </button>
          </div>
          {error && (
            <p className="checkout-alert checkout-alert--error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
