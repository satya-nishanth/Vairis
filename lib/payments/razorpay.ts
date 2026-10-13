import crypto from "node:crypto";
import type { PaymentGateway, PaymentWebhookEvent } from "./types";

/**
 * Razorpay adapter for the PaymentGateway port (lib/payments/types.ts).
 * Thin REST client — no SDK dependency.
 *
 * ─── CONFIGURATION STATUS ────────────────────────────────────────────────
 * The Razorpay account EXISTS but API keys are NOT yet in env. Until they
 * are added, isConfigured() returns false and every payment surface
 * (checkout API, checkout page, admin refund button) shows a clear
 * "payment setup in progress" state instead of crashing.
 *
 * To activate (test mode first), add to .env.local (+ Vercel env for prod):
 *   RAZORPAY_KEY_ID=rzp_test_xxxxxxxx        (dashboard → Settings → API Keys)
 *   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
 *   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxx   (same key id, for the browser SDK)
 *   RAZORPAY_WEBHOOK_SECRET=xxxxxxxx         (dashboard → Settings → Webhooks)
 *
 * Webhook to register in the dashboard once deployed:
 *   URL:    https://<domain>/api/webhooks/payment
 *   Events: payment.captured, payment.failed, refund.processed
 * Local dev doesn't need a public URL — scripts/_simulate-webhook.mjs
 * computes the same HMAC and posts events to localhost.
 * ─────────────────────────────────────────────────────────────────────────
 */

const RAZORPAY_API = "https://api.razorpay.com/v1";

function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

function authHeader(): string {
  const token = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
  return `Basic ${token}`;
}

async function rzpFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${RAZORPAY_API}${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Razorpay ${path} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Raw Razorpay webhook payload shapes (only the fields we read). */
type RzpWebhookBody = {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; error_description?: string } };
    refund?: { entity: { id: string; payment_id: string; amount: number } };
  };
};

export const razorpayGateway: PaymentGateway = {
  name: "razorpay",

  isConfigured() {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  },

  publicKey() {
    // Key id is public; fall back to server RAZORPAY_KEY_ID when the
    // NEXT_PUBLIC_ copy is missing (common on Azure — only the secretRef is set).
    return (
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ??
      process.env.RAZORPAY_KEY_ID ??
      null
    );
  },

  async createPaymentIntent(amount, reference) {
    const order = await rzpFetch<{ id: string; amount: number }>("/orders", {
      amount: toPaise(amount),
      currency: "INR",
      receipt: reference,
      payment_capture: 1, // auto-capture on authorization (single-step)
    });
    return {
      gatewayOrderId: order.id,
      // Consumed by the Razorpay browser SDK on the checkout page.
      clientParams: {
        key: this.publicKey(),
        order_id: order.id,
        amount: order.amount,
        currency: "INR",
      },
    };
  },

  verifyClientPayment({ gatewayOrderId, gatewayPaymentId, signature }) {
    if (!process.env.RAZORPAY_KEY_SECRET) return false;
    // signature = HMAC_SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${gatewayOrderId}|${gatewayPaymentId}`)
      .digest("hex");
    return timingSafeEqualHex(expected, signature);
  },

  async createRefund(gatewayPaymentId, amount, notes) {
    const refund = await rzpFetch<{ id: string }>(`/payments/${gatewayPaymentId}/refund`, {
      amount: toPaise(amount),
      speed: "normal",
      notes,
    });
    return { gatewayRefundId: refund.id };
  },

  parseWebhook(rawBody, headers): PaymentWebhookEvent | null {
    const signature = headers.get("x-razorpay-signature") ?? "";
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) return null;
    // Signature covers the RAW body bytes with the webhook secret
    // (a separate secret from the API key).
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    if (!timingSafeEqualHex(expected, signature)) return null;

    let body: RzpWebhookBody;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return null;
    }

    switch (body.event) {
      case "payment.captured": {
        const p = body.payload.payment?.entity;
        if (!p) return { type: "ignored" };
        return { type: "payment.captured", gatewayOrderId: p.order_id, gatewayPaymentId: p.id };
      }
      case "payment.failed": {
        const p = body.payload.payment?.entity;
        if (!p) return { type: "ignored" };
        return {
          type: "payment.failed",
          gatewayOrderId: p.order_id,
          reason: p.error_description ?? null,
        };
      }
      case "refund.processed": {
        const r = body.payload.refund?.entity;
        if (!r) return { type: "ignored" };
        return {
          type: "refund.processed",
          gatewayPaymentId: r.payment_id,
          gatewayRefundId: r.id,
          amount: r.amount / 100, // paise → rupees at the adapter boundary
        };
      }
      default:
        return { type: "ignored" };
    }
  },
};
