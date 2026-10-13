import crypto from "node:crypto";
import type { PaymentGateway, PaymentWebhookEvent } from "./types";

/**
 * Mock gateway — full payment lifecycle without Razorpay keys, for local
 * dev and e2e. Exercises the REAL application paths: the checkout page
 * opens /mock-pay (stand-in for the Razorpay modal), /api/mock-pay signs
 * outcomes and self-posts to /api/webhooks/payment with a valid HMAC, and
 * client verification goes through /api/payment/verify exactly like prod.
 *
 * Activate: PAYMENT_GATEWAY=mock (optionally MOCK_PAYMENT_SECRET).
 * Launch swap: set PAYMENT_GATEWAY=razorpay + real keys — no code change.
 *
 * SAFETY: refuses to run on Vercel production unless ALLOW_MOCK_PAYMENTS=true
 * — a store cannot silently launch with fake payments.
 */

export function mockSecret(): string {
  return process.env.MOCK_PAYMENT_SECRET ?? "vairis-mock-secret";
}

export function mockSign(payload: string): string {
  return crypto.createHmac("sha256", mockSecret()).update(payload).digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}

export function appUrl(): string {
  // Prefer public URL; on Azure Container Apps NEXT_PUBLIC_APP_URL may be
  // build-only / unset at runtime — APP_URL is set from the ingress FQDN.
  // Same-container loopback works for mock self-webhooks when both are missing.
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://127.0.0.1:3000"
  );
}

/** POST a normalized mock webhook event to our own webhook route. */
export async function postMockWebhook(event: Record<string, unknown>): Promise<void> {
  const rawBody = JSON.stringify(event);
  await fetch(`${appUrl()}/api/webhooks/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mock-signature": mockSign(rawBody),
    },
    body: rawBody,
  });
}

/** Mock webhook payload — already in normalized vocabulary. */
type MockWebhookBody = {
  event: "payment.captured" | "payment.failed" | "refund.processed";
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewayRefundId?: string;
  amount?: number;
  reason?: string | null;
};

export const mockGateway: PaymentGateway = {
  name: "mock",

  isConfigured() {
    if (process.env.VERCEL_ENV === "production" && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
      return false;
    }
    return true;
  },

  publicKey() {
    return "mock_public_key";
  },

  async createPaymentIntent(amount, reference) {
    const gatewayOrderId = randomId("mock_order");
    return {
      gatewayOrderId,
      clientParams: {
        mock: true,
        gatewayOrderId,
        amount, // rupees — display only on the mock modal
        reference,
      },
    };
  },

  verifyClientPayment({ gatewayOrderId, gatewayPaymentId, signature }) {
    const expected = mockSign(`${gatewayOrderId}|${gatewayPaymentId}`);
    return timingSafeEqualHex(expected, signature);
  },

  async createRefund(gatewayPaymentId, amount) {
    const gatewayRefundId = randomId("mock_rfnd");
    // The refund.processed webhook must land AFTER the caller inserts its
    // OrderRefund ledger row (webhook matches by gatewayRefundId). Delay the
    // self-post; in dev/e2e the server stays alive long enough.
    setTimeout(() => {
      postMockWebhook({
        event: "refund.processed",
        gatewayPaymentId,
        gatewayRefundId,
        amount,
      }).catch((err) => console.error("[mock-gateway] refund webhook failed", err));
    }, 800);
    return { gatewayRefundId };
  },

  parseWebhook(rawBody, headers): PaymentWebhookEvent | null {
    const signature = headers.get("x-mock-signature") ?? "";
    const expected = mockSign(rawBody);
    if (!timingSafeEqualHex(expected, signature)) return null;

    let body: MockWebhookBody;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return null;
    }

    switch (body.event) {
      case "payment.captured":
        if (!body.gatewayOrderId || !body.gatewayPaymentId) return { type: "ignored" };
        return {
          type: "payment.captured",
          gatewayOrderId: body.gatewayOrderId,
          gatewayPaymentId: body.gatewayPaymentId,
        };
      case "payment.failed":
        if (!body.gatewayOrderId) return { type: "ignored" };
        return {
          type: "payment.failed",
          gatewayOrderId: body.gatewayOrderId,
          reason: body.reason ?? null,
        };
      case "refund.processed":
        if (!body.gatewayPaymentId || !body.gatewayRefundId || body.amount === undefined) {
          return { type: "ignored" };
        }
        return {
          type: "refund.processed",
          gatewayPaymentId: body.gatewayPaymentId,
          gatewayRefundId: body.gatewayRefundId,
          amount: body.amount,
        };
      default:
        return { type: "ignored" };
    }
  },
};
