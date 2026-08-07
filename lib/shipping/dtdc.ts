import type { ShipmentBooking, ShipmentRequest, ShippingProvider, TrackingUpdate } from "./types";

/**
 * DTDC adapter — real API shapes (Shipsy-powered DTDC customer integration),
 * ready for production keys.
 *
 * Env:
 *   SHIPPING_PROVIDER=dtdc
 *   DTDC_API_KEY=<integration api key>     (from DTDC account manager)
 *   DTDC_CUSTOMER_CODE=<customer code>
 *   DTDC_SERVICE_TYPE=<service>            (optional, default "B2C PRIORITY")
 *   SHIPPING_MOCK=true                     (optional — deterministic fixtures, no network)
 *
 * API flow:
 *   POST /api/customer/integration/consignment/softdata  → reference (AWB) number
 *   POST /api/customer/integration/consignment/track     → tracking events
 */

const API = "https://dtdcapi.shipsy.io";

function isMock(): boolean {
  return process.env.SHIPPING_MOCK === "true";
}

async function dtdcFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.DTDC_API_KEY ?? "",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`DTDC ${path} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export const dtdcProvider: ShippingProvider = {
  name: "dtdc",
  supportsBooking: true,

  async bookShipment(request: ShipmentRequest): Promise<ShipmentBooking> {
    if (isMock()) {
      const suffix = request.orderId.slice(-6).toUpperCase();
      return {
        providerShipmentId: `DTDCMOCK-${suffix}`,
        courierName: "DTDC (mock)",
        awbCode: `D${suffix}00${suffix.slice(0, 2)}`,
        trackingUrl: `https://www.dtdc.in/trace.asp?awb=D${suffix}`,
      };
    }

    const data = await dtdcFetch<{
      success: boolean;
      data: { success: boolean; reference_number: string }[];
    }>("/api/customer/integration/consignment/softdata", {
      consignments: [
        {
          customer_code: process.env.DTDC_CUSTOMER_CODE,
          service_type_id: process.env.DTDC_SERVICE_TYPE ?? "B2C PRIORITY",
          load_type: "NON-DOCUMENT",
          declared_value: String(request.declaredValue),
          num_pieces: "1",
          origin_details: {}, // pickup profile configured on the DTDC account
          destination_details: {
            name: request.contactName,
            phone: request.contactPhone,
            address_line_1: request.addressLine1,
            address_line_2: request.addressLine2 ?? "",
            pincode: request.pincode,
            city: request.city,
            state: request.state,
          },
          customer_reference_number: request.orderId,
          cod_collection_mode: "",
          cod_amount: "0",
          commodity_id: "7", // jewellery
          pieces_detail: [
            {
              description: `VAIRIS order ${request.orderId}`,
              declared_value: String(request.declaredValue),
              weight: "0.25",
              height: "5",
              length: "10",
              width: "10",
            },
          ],
        },
      ],
    });

    const consignment = data.data?.[0];
    if (!consignment?.success || !consignment.reference_number) {
      throw new Error("DTDC softdata booking did not return a reference number");
    }

    return {
      providerShipmentId: consignment.reference_number,
      courierName: "DTDC",
      awbCode: consignment.reference_number,
      trackingUrl: `https://www.dtdc.in/trace.asp?awb=${consignment.reference_number}`,
    };
  },

  async trackShipment(awbCode: string): Promise<TrackingUpdate[]> {
    if (isMock()) {
      return [
        { status: "PICKED_UP", description: "Shipment picked up (mock)", timestamp: new Date() },
      ];
    }
    const data = await dtdcFetch<{
      trackHeader?: unknown;
      trackDetails?: { strAction: string; strActionDate: string; strActionTime: string; strOrigin: string }[];
    }>("/api/customer/integration/consignment/track", {
      trkType: "cnno",
      strcnno: awbCode,
      addtnlDtl: "Y",
    });

    return (data.trackDetails ?? []).map((d) => ({
      status: d.strAction,
      description: `${d.strAction} — ${d.strOrigin}`,
      // strActionDate: DDMMYYYY, strActionTime: HHMM
      timestamp: parseDtdcTimestamp(d.strActionDate, d.strActionTime),
    }));
  },
};

function parseDtdcTimestamp(date: string, time: string): Date {
  if (!/^\d{8}$/.test(date)) return new Date();
  const dd = Number(date.slice(0, 2));
  const mm = Number(date.slice(2, 4)) - 1;
  const yyyy = Number(date.slice(4, 8));
  const hh = /^\d{4}$/.test(time) ? Number(time.slice(0, 2)) : 0;
  const min = /^\d{4}$/.test(time) ? Number(time.slice(2, 4)) : 0;
  return new Date(yyyy, mm, dd, hh, min);
}
