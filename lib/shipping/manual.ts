import type { ShippingProvider } from "./types";

/**
 * Manual shipping provider — active until a delivery partner is chosen.
 * Admins enter courier name, AWB and tracking URL by hand on
 * /admin/orders/[id] when marking an order SHIPPED. No external calls.
 */
export const manualShippingProvider: ShippingProvider = {
  name: "manual",
  supportsBooking: false,

  async bookShipment() {
    // Guarded by supportsBooking in the admin UI; reaching here is a bug.
    throw new Error(
      "Manual shipping provider cannot book shipments — enter courier details in the admin order page.",
    );
  },

  async trackShipment() {
    // No provider API — customers see our OrderEvent timeline + the
    // admin-entered tracking URL instead.
    return [];
  },
};
