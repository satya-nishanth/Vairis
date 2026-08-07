"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Customer-initiated return request ("Easy Returns") — hits
 * /api/orders/[id]/return-request. Rendered by the order detail page only
 * when the order is within RETURN_WINDOW_DAYS of its DELIVERED event
 * (server computes eligibility; see app/account/orders/[id]/page.tsx).
 */
export function ReturnRequestButton({
  orderId,
  eligibleUntil,
}: {
  orderId: string;
  eligibleUntil: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deadline = new Date(eligibleUntil).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  async function handleSubmit() {
    setError(null);
    if (reason.trim().length < 5) {
      setError("Tell us briefly why (at least 5 characters).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/return-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit your return request. Please try again.");
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
    <section className="confirm-card">
      <h3 className="confirm-card__heading">Not Quite Right?</h3>
      {!open ? (
        <>
          <p className="checkout-note">Returns are accepted until {deadline}.</p>
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
            Request Return (until {deadline})
          </button>
        </>
      ) : (
        <div className="form-group">
          <label htmlFor="return-reason">Reason for return</label>
          <textarea
            id="return-reason"
            className="form-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tell us briefly why you'd like to return this order"
            rows={3}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Confirm Return Request"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setOpen(false);
                setError(null);
                setReason("");
              }}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="checkout-alert checkout-alert--error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
