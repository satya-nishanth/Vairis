import type { ShipmentBooking, ShipmentRequest, ShippingProvider, TrackingUpdate } from "./types";

/**
 * Shiprocket adapter — real API shapes, ready for production keys.
 *
 * Env:
 *   SHIPPING_PROVIDER=shiprocket
 *   SHIPROCKET_EMAIL=<api user email>       (dashboard → Settings → API → Create user)
 *   SHIPROCKET_PASSWORD=<api user password>
 *   SHIPROCKET_PICKUP_LOCATION=<nickname>   (optional, default "Primary")
 *   SHIPPING_MOCK=true                      (optional — deterministic fixtures, no network;
 *                                            for dev/e2e before keys exist)
 *
 * API flow (https://apidocs.shiprocket.in):
 *   POST /auth/login                → bearer token (valid 10 days, cached in-process)
 *   POST /orders/create/adhoc       → { order_id, shipment_id }
 *   POST /courier/assign/awb        → { awb_code, courier_name }
 *   GET  /courier/track/awb/{awb}   → shipment_track_activities[]
 */

const API = "https://apiv2.shiprocket.in/v1/external";

function isMock(): boolean {
  return process.env.SHIPPING_MOCK === "true";
}

let cachedToken: { token: string; fetchedAt: number } | null = null;
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000; // refresh before the 10-day expiry

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.fetchedAt < TOKEN_TTL_MS) {
    return cachedToken.token;
  }
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    }),
  });
  if (!res.ok) {
    throw new Error(`Shiprocket auth failed (${res.status})`);
  }
  const data = (await res.json()) as { token: string };
  cachedToken = { token: data.token, fetchedAt: Date.now() };
  return data.token;
}

async function srFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Shiprocket ${path} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export const shiprocketProvider: ShippingProvider = {
  name: "shiprocket",
  supportsBooking: true,

  async bookShipment(request: ShipmentRequest): Promise<ShipmentBooking> {
    if (isMock()) {
      // Deterministic fixture keyed on the order id — e2e can assert on it.
      const suffix = request.orderId.slice(-6).toUpperCase();
      return {
        providerShipmentId: `SRMOCK-${suffix}`,
        courierName: "Bluedart (Shiprocket mock)",
        awbCode: `AWBSR${suffix}`,
        trackingUrl: `https://shiprocket.co/tracking/AWBSR${suffix}`,
      };
    }

    const order = await srFetch<{ order_id: number; shipment_id: number }>(
      "/orders/create/adhoc",
      {
        method: "POST",
        body: JSON.stringify({
          order_id: request.orderId,
          order_date: new Date().toISOString().slice(0, 10),
          pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION ?? "Primary",
          billing_customer_name: request.contactName,
          billing_last_name: "",
          billing_address: request.addressLine1,
          billing_address_2: request.addressLine2 ?? "",
          billing_city: request.city,
          billing_pincode: request.pincode,
          billing_state: request.state,
          billing_country: "India",
          billing_email: "",
          billing_phone: request.contactPhone,
          shipping_is_billing: true,
          order_items: [
            {
              name: `VAIRIS order ${request.orderId}`,
              sku: request.orderId,
              units: 1,
              selling_price: request.declaredValue,
            },
          ],
          payment_method: "Prepaid",
          sub_total: request.declaredValue,
          // Jewellery parcel defaults — small, light, insured
          length: 10,
          breadth: 10,
          height: 5,
          weight: 0.25,
        }),
      },
    );

    const awb = await srFetch<{
      response: { data: { awb_code: string; courier_name: string } };
    }>("/courier/assign/awb", {
      method: "POST",
      body: JSON.stringify({ shipment_id: order.shipment_id }),
    });

    return {
      providerShipmentId: String(order.shipment_id),
      courierName: awb.response.data.courier_name,
      awbCode: awb.response.data.awb_code,
      trackingUrl: `https://shiprocket.co/tracking/${awb.response.data.awb_code}`,
    };
  },

  async trackShipment(awbCode: string): Promise<TrackingUpdate[]> {
    if (isMock()) {
      return [
        { status: "PICKED_UP", description: "Shipment picked up (mock)", timestamp: new Date() },
      ];
    }
    const data = await srFetch<{
      tracking_data?: {
        shipment_track_activities?: { status: string; activity: string; date: string }[];
      };
    }>(`/courier/track/awb/${encodeURIComponent(awbCode)}`, { method: "GET" });

    return (data.tracking_data?.shipment_track_activities ?? []).map((a) => ({
      status: a.status,
      description: a.activity,
      timestamp: new Date(a.date),
    }));
  },
};
