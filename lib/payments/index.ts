import type { PaymentGateway } from "./types";
import { razorpayGateway } from "./razorpay";
import { mockGateway } from "./mock";

export type { PaymentGateway, PaymentIntent, PaymentWebhookEvent, RefundResult } from "./types";

/**
 * Gateway registry + selection. To add a gateway: implement PaymentGateway
 * in lib/payments/<name>.ts, add it here, set PAYMENT_GATEWAY=<name>.
 * Defaults to razorpay. "mock" = full local/e2e lifecycle without keys
 * (guarded against production use — see lib/payments/mock.ts).
 */
const GATEWAYS: Record<string, PaymentGateway> = {
  razorpay: razorpayGateway,
  mock: mockGateway,
};

export function getPaymentGateway(): PaymentGateway {
  const name = process.env.PAYMENT_GATEWAY ?? "razorpay";
  const gateway = GATEWAYS[name];
  if (!gateway) {
    throw new Error(
      `Unknown PAYMENT_GATEWAY "${name}". Registered: ${Object.keys(GATEWAYS).join(", ")}`,
    );
  }
  return gateway;
}
