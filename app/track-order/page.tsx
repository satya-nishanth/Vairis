"use client";

import { useState } from "react";
import type { OrderStatus } from "@prisma/client";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { OrderStatusChip, OrderTimeline } from "@/components/commerce/OrderTimeline";
import { pageLayouts } from "@/lib/layout-config";

/**
 * Public order tracking — order id + purchase email, no login required.
 * (The footer "Track Order" link lands here.) Logged-in customers get the
 * richer view at /account/orders/[id]; this page is for gift recipients,
 * shared devices, and "where's my ring" moments.
 */

type TrackShipment = { courierName: string | null; awbCode: string | null; trackingUrl: string | null } | null;

type TrackNote = { body: string; createdAt: string };

type TrackChild = {
  orderId: string;
  status: OrderStatus;
  events: { status: OrderStatus; note: string | null; createdAt: string }[];
  /** Customer-visible notes only — server already filtered internal:true. */
  notes: TrackNote[];
  shipment: TrackShipment;
};

type TrackResult = {
  orderId: string;
  status: OrderStatus;
  events: { status: OrderStatus; note: string | null; createdAt: string }[];
  /** Customer-visible notes only — server already filtered internal:true. */
  notes: TrackNote[];
  shipment: TrackShipment;
  /** Present when this order is a split parent (lib/split.ts) — one summary per delivery. */
  children?: TrackChild[];
};

export default function TrackOrderPage() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/track-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderId.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not find that order.");
        return;
      }
      setResult(data as TrackResult);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell {...pageLayouts.contact}>
      <Container>
        <div className="orders-page orders-page--narrow">
          <h1 className="orders-page__title">Track Your Order</h1>
          <p className="checkout-note">
            Enter your order ID (from your confirmation email) and the email used at checkout.
          </p>

          <form className="track-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="track-id">Order ID</label>
              <input
                id="track-id"
                className="form-input"
                type="text"
                required
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="e.g. cmox…"
              />
            </div>
            <div className="form-group">
              <label htmlFor="track-email">Email</label>
              <input
                id="track-email"
                className="form-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Looking up…" : "Track Order"}
            </button>
            {error && (
              <p className="checkout-alert checkout-alert--error" role="alert">
                {error}
              </p>
            )}
          </form>

          {result && (
            <section className="confirm-card track-result">
              <div className="order-detail__head">
                <h2 className="confirm-card__heading">Order {result.orderId}</h2>
                <OrderStatusChip status={result.status} />
              </div>
              <OrderTimeline
                status={result.status}
                events={result.events.map((e) => ({ ...e, createdAt: new Date(e.createdAt) }))}
                notes={result.notes.map((n) => ({ ...n, createdAt: new Date(n.createdAt) }))}
              />
              {result.shipment?.trackingUrl && (
                <p className="checkout-note">
                  {result.shipment.courierName} · AWB {result.shipment.awbCode} ·{" "}
                  <a href={result.shipment.trackingUrl} target="_blank" rel="noopener noreferrer">
                    Track with courier ↗
                  </a>
                </p>
              )}

              {result.children && result.children.length > 0 && (
                <div className="order-deliveries" style={{ marginTop: 16 }}>
                  <h3 className="confirm-card__heading">{result.children.length} Deliveries</h3>
                  {result.children.map((child, i) => (
                    <div key={child.orderId} className="order-deliveries__item">
                      <div className="order-deliveries__head">
                        <strong>Delivery {i + 1} of {result.children!.length} — {child.orderId}</strong>
                        <OrderStatusChip status={child.status} />
                      </div>
                      <OrderTimeline
                        status={child.status}
                        events={child.events.map((e) => ({ ...e, createdAt: new Date(e.createdAt) }))}
                        notes={child.notes.map((n) => ({ ...n, createdAt: new Date(n.createdAt) }))}
                      />
                      {child.shipment?.trackingUrl && (
                        <p className="checkout-note">
                          {child.shipment.courierName} · AWB {child.shipment.awbCode} ·{" "}
                          <a href={child.shipment.trackingUrl} target="_blank" rel="noopener noreferrer">
                            Track with courier ↗
                          </a>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </Container>
    </PageShell>
  );
}
