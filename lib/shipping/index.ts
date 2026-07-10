import type { ShippingProvider } from "./types";
import { manualShippingProvider } from "./manual";

export type { ShippingProvider, ShipmentRequest, ShipmentBooking, TrackingUpdate } from "./types";

/**
 * Provider registry + selection. To add a courier partner (e.g. Shiprocket):
 * implement ShippingProvider in lib/shipping/<name>.ts, add it here,
 * set SHIPPING_PROVIDER=<name>. Defaults to manual (partner undecided).
 */
const PROVIDERS: Record<string, ShippingProvider> = {
  manual: manualShippingProvider,
};

export function getShippingProvider(): ShippingProvider {
  const name = process.env.SHIPPING_PROVIDER ?? "manual";
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `Unknown SHIPPING_PROVIDER "${name}". Registered: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }
  return provider;
}
