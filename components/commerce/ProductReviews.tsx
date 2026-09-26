"use client";

import { useCallback, useEffect, useState } from "react";
import { useCart } from "@/components/commerce/CartProvider";

type ReviewItem = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  images: string[];
  authorName: string;
  verified: boolean;
  adminReply: string | null;
  createdAt: string;
};

type ReviewData = {
  average: number | null;
  total: number;
  histogram: Record<number, number>;
  reviews: ReviewItem[];
};

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span aria-label={`${value} out of 5 stars`} style={{ fontSize: size, letterSpacing: 1, color: "#b8963e" }}>
      {"★".repeat(Math.round(value))}
      <span style={{ opacity: 0.3 }}>{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

export function ProductReviews({ productId, productName }: { productId: string; productName: string }) {
  const { isLoggedIn, hydrated } = useCart();
  const [data, setData] = useState<ReviewData | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/products/${productId}/reviews`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, [productId]);

  useEffect(load, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a star rating (1 to 5 stars).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, title: title || undefined, body }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Could not submit your review.");
        return;
      }
      setFormOpen(false);
      setTitle("");
      setBody("");
      setNotice("Thank you! Your review is awaiting moderation and will appear shortly.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) return null;

  return (
    <section className="pdp-reviews" data-testid="pdp-reviews">
      <h2 className="pdp-reviews__title">Reviews{data.total > 0 ? ` (${data.total})` : ""}</h2>

      {data.total > 0 && data.average != null ? (
        <div className="pdp-reviews__summary">
          <div className="pdp-reviews__average">
            <strong>{data.average.toFixed(1)}</strong>
            <Stars value={data.average} size={16} />
            <span className="pdp-reviews__count">{data.total} review{data.total === 1 ? "" : "s"}</span>
          </div>
          <div className="pdp-reviews__histogram">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = data.histogram[star] ?? 0;
              const pct = data.total > 0 ? (count / data.total) * 100 : 0;
              return (
                <div key={star} className="pdp-reviews__bar-row">
                  <span>{star}★</span>
                  <div className="pdp-reviews__bar">
                    <div className="pdp-reviews__bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="pdp-reviews__empty">
          No reviews yet — be the first to review {productName}.
        </p>
      )}

      {notice && (
        <p className="checkout-note" role="status">
          {notice}
        </p>
      )}

      {hydrated && isLoggedIn && !formOpen && !notice && (
        <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(true)}>
          Write a Review
        </button>
      )}
      {hydrated && !isLoggedIn && (
        <p className="pdp-reviews__empty">
          <a href={`/auth/login?next=/product/${productId}`}>Sign in</a> to write a review.
        </p>
      )}

      {formOpen && (
        <form onSubmit={submit} className="pdp-reviews__form" data-testid="review-form">
          <label>
            Your rating
            <div className="pdp-reviews__rating-picker" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  onClick={() => setRating(n)}
                  className={n <= rating ? "is-active" : ""}
                >
                  ★
                </button>
              ))}
            </div>
          </label>
          <label>
            Title <span className="form-group__optional">(optional)</span>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. Even prettier in person"
            />
          </label>
          <label>
            Your review
            <textarea
              className="form-input"
              rows={4}
              required
              minLength={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="How is the craftsmanship, sparkle, fit…?"
            />
          </label>
          {error && (
            <p className="checkout-alert checkout-alert--error" role="alert">
              {error}
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Review"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "12px", lineHeight: 1.4 }}>
            Reviews are moderated to prevent spam and ensure genuine customer experiences. Verified Buyer badges are automatically granted for orders confirmed through verified delivery.
          </p>
        </form>
      )}

      {data.reviews.length > 0 && (
        <ul className="pdp-reviews__list">
          {data.reviews.map((r) => (
            <li key={r.id} className="pdp-reviews__item">
              <div className="pdp-reviews__item-head">
                <Stars value={r.rating} />
                {r.title && <strong>{r.title}</strong>}
              </div>
              <p className="pdp-reviews__body">{r.body}</p>
              <p className="pdp-reviews__meta">
                {r.authorName}
                {r.verified && <span className="pdp-reviews__verified">✓ Verified Purchase</span>} ·{" "}
                {new Date(r.createdAt).toLocaleDateString("en-IN", {
                  month: "short",
                  year: "numeric",
                })}
              </p>
              {r.adminReply && (
                <p className="pdp-reviews__reply">
                  <strong>VAIRIS:</strong> {r.adminReply}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
