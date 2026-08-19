import type { ShippingProvider } from "./types";
import { manualShippingProvider } from "./manual";
import { shiprocketProvider } from "./shiprocket";
import { dtdcProvider } from "./dtdc";
import { sequel247Provider } from "./sequel247";

export type { ShippingProvider, ShipmentRequest, ShipmentBooking, TrackingUpdate } from "./types";

/**
 * Provider registry + selection. Set SHIPPING_PROVIDER=manual|shiprocket|dtdc|sequel247.
 * Shiprocket/DTDC/Sequel247 support SHIPPING_MOCK=true for keyless dev/e2e fixtures.
 * Defaults to manual (admin types courier + AWB by hand).
 */
const PROVIDERS: Record<string, ShippingProvider> = {
  manual: manualShippingProvider,
  shiprocket: shiprocketProvider,
  dtdc: dtdcProvider,
  sequel247: sequel247Provider,
};

/**
 * @param country Order's delivery country (Order.country / Address.country).
 *   Pass this whenever a specific order is in play. Any value other than
 *   "IN" always resolves to the manual provider, regardless of
 *   SHIPPING_PROVIDER — Sequel247 (and Shiprocket/DTDC as currently
 *   configured) are India-domestic only, so there is nothing else safe to
 *   route international shipments through yet. Omit only for
 *   country-agnostic callers (e.g. admin settings screens that just need
 *   "which provider is configured").
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
