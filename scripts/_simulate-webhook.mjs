/**
 * Simulate Razorpay webhook deliveries against local dev.
 *
 * Lets the full order lifecycle be exercised WITHOUT a public URL or real
 * dashboard-registered webhook: computes the same HMAC-SHA256 the gateway
 * would (RAZORPAY_WEBHOOK_SECRET from .env.local) and posts to
 * /api/webhooks/payment.
 *
 * Usage:
 *   node scripts/_simulate-webhook.mjs captured <gatewayOrderId> <gatewayPaymentId>
 *   node scripts/_simulate-webhook.mjs failed   <gatewayOrderId> [reason]
 *   node scripts/_simulate-webhook.mjs refund   <gatewayPaymentId> <refundId> <amountRupees>
 */
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";

function envSecret() {
  if (process.env.RAZORPAY_WEBHOOK_SECRET) return process.env.RAZORPAY_WEBHOOK_SECRET;
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const m = env.match(/^RAZORPAY_WEBHOOK_SECRET=(.+)$/m);
    if (m) return m[1].trim();
  } catch {}
  console.error("RAZORPAY_WEBHOOK_SECRET not found in env or .env.local");
  process.exit(1);
}

const [, , kind, ...args] = process.argv;

let body;
if (kind === "captured") {
  const [orderId, paymentId] = args;
  body = {
    event: "payment.captured",
    payload: { payment: { entity: { id: paymentId, order_id: orderId } } },
  };
} else if (kind === "failed") {
  const [orderId, reason] = args;
  body = {
    event: "payment.failed",
    payload: {
      payment: { entity: { id: "pay_failed_sim", order_id: orderId, error_description: reason } },
    },
  };
} else if (kind === "refund") {
  const [paymentId, refundId, amountRupees] = args;
  body = {
    event: "refund.processed",
    payload: {
      refund: {
        entity: { id: refundId, payment_id: paymentId, amount: Math.round(Number(amountRupees) * 100) },
      },
    },
  };
} else {
  console.error("usage: _simulate-webhook.mjs captured|failed|refund ...");
  process.exit(1);
}

const raw = JSON.stringify(body);
const signature = crypto.createHmac("sha256", envSecret()).update(raw).digest("hex");

const res = await fetch(`${BASE}/api/webhooks/payment`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-razorpay-signature": signature },
  body: raw,
});
console.log(res.status, await res.text());
