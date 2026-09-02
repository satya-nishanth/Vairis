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

/**
 * @param country Order delivery country. Non-IN always uses manual provider.
 *   Omit for country-agnostic callers.
 */
export function getShippingProvider(country?: string): ShippingProvider {
  if (country !== undefined && country !== "IN") {
    return manualShippingProvider;
  }
  const name = process.env.SHIPPING_PROVIDER ?? "manual";
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `Unknown SHIPPING_PROVIDER "${name}". Registered: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }
  return provider;
}
