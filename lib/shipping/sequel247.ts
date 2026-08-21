import type { ShipmentBooking, ShipmentRequest, ShippingProvider, TrackingUpdate } from "./types";

/**
 * Sequel247 adapter — India-domestic courier (Sequel Logistics), the chosen
 * delivery partner. API confirmed against the live UAT docs at
 * sequel247.com/api/ (see design doc for the full endpoint list).
 *
 * Env:
 *   SHIPPING_PROVIDER=sequel247
 *   SEQUEL247_TOKEN=<uat or prod token from Sequel Team>
 *   SEQUEL247_BASE_URL=https://test.sequel247.com | https://sequel247.com
 *   SEQUEL247_STORE_CODE=<pickup store code, e.g. HYDVFJ>
 *   SHIPPING_MOCK=true                     (optional — deterministic fixtures, no network)
 *
 * API flow:
 *   POST /api/shipment/create        → docketNumber (AWB)
 *   POST /api/track                  → tracking_events[]
 *
 * India-only: this adapter is never selected for a non-India order —
 * getShippingProvider(order.country) in lib/shipping/index.ts forces
 * "manual" for any country other than "IN", regardless of
 * SHIPPING_PROVIDER, since Sequel247 cannot fulfill international
 * shipments.
 */

function baseUrl(): string {
  return process.env.SEQUEL247_BASE_URL ?? "https://test.sequel247.com";
}

function isMock(): boolean {
  return process.env.SHIPPING_MOCK === "true";
}

async function sequelFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: process.env.SEQUEL247_TOKEN ?? "", ...body }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Sequel247 ${path} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export const sequel247Provider: ShippingProvider = {
  name: "sequel247",
  supportsBooking: true,

  async bookShipment(request: ShipmentRequest): Promise<ShipmentBooking> {
    if (isMock()) {
      const suffix = request.orderId.slice(-6).toUpperCase();
      return {
        providerShipmentId: `SEQMOCK-${suffix}`,
        courierName: "Sequel247 (mock)",
        awbCode: `05${suffix}`,
        trackingUrl: null,
      };
    }

    const data = await sequelFetch<{
      status: string;
      data?: { docketNumber: string };
    }>("/api/shipment/create", {
      location: "domestic",
      shipmentType: "D&J",
      serviceType: "valuable",
      fromStoreCode: process.env.SEQUEL247_STORE_CODE ?? "",
      toAddress: {
        consignee_name: request.contactName,
        address_line1: request.addressLine1,
        address_line2: request.addressLine2 ?? "",
        pinCode: request.pincode,
        auth_receiver_name: request.contactName,
        auth_receiver_phone: request.contactPhone,
      },
      net_weight: "10",
      net_value: request.declaredValue,
      no_of_packages: "1",
      remark: `VAIRIS order ${request.orderId}`,
    });

    const docketNumber = data.data?.docketNumber;
    if (data.status !== "true" || !docketNumber) {
      console.error("[sequel247] shipment/create unexpected response", JSON.stringify(data));
      throw new Error("Sequel247 shipment/create did not return a docket number");
    }

    return {
      providerShipmentId: docketNumber,
      courierName: "Sequel247",
      awbCode: docketNumber,
      // No public tracking URL found in Sequel247's docs — see design doc
      // "Open items". Customers see our own OrderEvent timeline instead,
      // same as the manual provider.
      trackingUrl: null,
    };
  },

  async trackShipment(awbCode: string): Promise<TrackingUpdate[]> {
    if (isMock()) {
      return [
        { status: "PICKED_UP", description: "Shipment picked up (mock)", timestamp: new Date() },
      ];
    }

    const data = await sequelFetch<{
      status: string;
      data?: { tracking_events?: { description: string; location: string; date_time: string }[] };
    }>("/api/track", { docket: awbCode });

    return (data.data?.tracking_events ?? []).map((e) => ({
      status: e.location ? `${e.description} — ${e.location}` : e.description,
      description: e.description,
      timestamp: parseSequelTimestamp(e.date_time),
    }));
  },
};

/** Sequel247 date_time format: "YYYY-MM-DD HH:mm:ss". */
function parseSequelTimestamp(value: string): Date {
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
