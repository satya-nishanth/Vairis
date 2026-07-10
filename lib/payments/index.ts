import type { PaymentGateway } from "./types";
import { razorpayGateway } from "./razorpay";

export type { PaymentGateway, PaymentIntent, PaymentWebhookEvent, RefundResult } from "./types";

/**
 * Gateway registry + selection. To add a gateway: implement PaymentGateway
 * in lib/payments/<name>.ts, add it here, set PAYMENT_GATEWAY=<name>.
 * Defaults to razorpay (the only adapter today).
 */
const GATEWAYS: Record<string, PaymentGateway> = {
  razorpay: razorpayGateway,
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
