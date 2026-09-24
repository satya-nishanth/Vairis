/**
 * Shipping provider port — mirror of the payments port (lib/payments).
 * Application code imports ONLY from lib/shipping; adding a courier
 * partner is:
 *
 *   1. add lib/shipping/<provider>.ts implementing ShippingProvider
 *   2. register it in lib/shipping/index.ts
 *   3. set SHIPPING_PROVIDER=<provider> in env
 *
 * ─── DELIVERY PARTNER: SEQUEL247 (India-domestic) ────────────────────────
 * Vairis has picked Sequel247 (see lib/shipping/sequel247.ts) for India
 * shipments. It cannot fulfill international orders — getShippingProvider()
 * takes an optional order country and always resolves to "manual" for any
 * non-"IN" value, regardless of SHIPPING_PROVIDER. The "manual" provider
 * (admin types courier + AWB + tracking URL when marking an order SHIPPED)
 * is the fallback for international orders and for any account without a
 * partner adapter configured.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type ShipmentRequest = {
  orderId: string;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  /** Declared value in rupees — jewellery shipments must be insured. */
  declaredValue: number;
};

export type ShipmentBooking = {
  providerShipmentId: string | null;
  courierName: string;
  awbCode: string;
  trackingUrl: string | null;
};

export type TrackingUpdate = {
  status: string;
  description: string;
  timestamp: Date;
};

export type ShippingProvider = {
  /** Machine name, matches SHIPPING_PROVIDER env value. */
  name: string;

  /**
   * True when shipments are booked via the provider's API.
   * False (manual provider) → the admin UI shows courier/AWB input fields
   * instead of a "Book shipment" button.
   */
  supportsBooking: boolean;

  /**
   * Book a pickup with the courier. Manual provider throws — the admin UI
   * never calls it when supportsBooking is false.
   */
  bookShipment(request: ShipmentRequest): Promise<ShipmentBooking>;

  /**
   * Live tracking events for the customer order page. Manual provider
   * returns [] — the page then shows only our own OrderEvent timeline.
   */
  trackShipment(awbCode: string): Promise<TrackingUpdate[]>;
};
