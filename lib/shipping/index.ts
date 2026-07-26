import type { ShippingProvider } from "./types";
import { manualShippingProvider } from "./manual";
import { shiprocketProvider } from "./shiprocket";
import { dtdcProvider } from "./dtdc";

export type { ShippingProvider, ShipmentRequest, ShipmentBooking, TrackingUpdate } from "./types";

/**
 * Provider registry + selection. Set SHIPPING_PROVIDER=manual|shiprocket|dtdc.
 * Shiprocket/DTDC support SHIPPING_MOCK=true for keyless dev/e2e fixtures.
 * Defaults to manual (admin types courier + AWB by hand).
 */
const PROVIDERS: Record<string, ShippingProvider> = {
  manual: manualShippingProvider,
  shiprocket: shiprocketProvider,
  dtdc: dtdcProvider,
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
