/**
 * Payment gateway port — every gateway (Razorpay today, anything later)
 * implements this interface. Application code (checkout API, verify API,
 * webhook route, admin refunds) imports ONLY from lib/payments — never a
 * concrete adapter — so swapping gateways is:
 *
 *   1. add lib/payments/<gateway>.ts implementing PaymentGateway
 *   2. register it in lib/payments/index.ts
 *   3. set PAYMENT_GATEWAY=<gateway> in env
 *
 * Amounts everywhere in this interface are RUPEES (number). Adapters own
 * any smallest-unit conversion (Razorpay wants paise — its adapter converts).
 */

export type PaymentIntent = {
  /** Gateway-side order/intent id — stored as Payment.razorpayOrderId (column name is historical). */
  gatewayOrderId: string;
  /**
   * Opaque params the checkout page passes to the gateway's browser SDK.
   * Shape is gateway-specific by design; the page forwards it untouched.
   */
  clientParams: Record<string, unknown>;
};

export type RefundResult = {
  /** Gateway-side refund id. */
  gatewayRefundId: string;
};

/** Normalized webhook events — the only vocabulary application code handles. */
export type PaymentWebhookEvent =
  | {
      type: "payment.captured";
      gatewayOrderId: string;
      gatewayPaymentId: string;
    }
  | {
      type: "payment.failed";
      gatewayOrderId: string;
      reason: string | null;
    }
  | {
      type: "refund.processed";
      gatewayPaymentId: string;
      gatewayRefundId: string;
      /** Refunded amount in rupees. */
      amount: number;
    }
  | {
      /** Event types we don't act on — acknowledged so the gateway stops retrying. */
      type: "ignored";
    };

export type PaymentGateway = {
  /** Machine name, matches PAYMENT_GATEWAY env value. */
  name: string;

  /** False until the gateway's env keys are present — callers must degrade gracefully. */
  isConfigured(): boolean;

  /** Publishable key/id the browser SDK needs (null until configured). */
  publicKey(): string | null;

  /**
   * Create a gateway-side payment intent for `amount` rupees.
   * `reference` is our Order.id — must appear in the gateway dashboard for
   * 1:1 reconciliation.
   */
  createPaymentIntent(amount: number, reference: string): Promise<PaymentIntent>;

  /**
   * Verify the proof-of-payment the gateway's browser SDK hands back after
   * a successful payment (Razorpay: HMAC signature over order|payment ids).
   */
  verifyClientPayment(params: {
    gatewayOrderId: string;
    gatewayPaymentId: string;
    signature: string;
  }): boolean;

  /**
   * Refund `amount` rupees of a captured payment. Used for the 5% security
   * deposit after delivery and full refunds on cancellation. `notes` land
   * in the gateway dashboard for the accountant.
   */
  createRefund(
    gatewayPaymentId: string,
    amount: number,
    notes: Record<string, string>,
  ): Promise<RefundResult>;

  /**
   * Verify + parse a webhook delivery into a normalized event.
   * Returns null when the signature is invalid (caller responds 400).
   * MUST be given the raw, unparsed request body — signatures cover bytes.
   */
  parseWebhook(rawBody: string, headers: Headers): PaymentWebhookEvent | null;
};
