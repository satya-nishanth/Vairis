# Sequel247 Delivery Integration + Address Validation — Design

Date: 2026-08-19
Branch: stage_preprod (test only, no push to master)

## Context

Vairis has picked a delivery partner: **Sequel247** (Sequel Logistics, Hyderabad).
Client code 31424, store codes `HYDVFJ` / `SANST`. UAT and prod API tokens
were issued (see `new Ecom Account - VAIRIS FINE JEWELLERY PRIVATE
LIMITED.eml` in Downloads — tokens are secrets, go to env vars only, never
committed).

The existing shipping port (`lib/shipping/`) already supports `manual`,
`shiprocket`, `dtdc` adapters behind a `ShippingProvider` interface — this
work adds a fourth: `sequel247`. The address book (`lib/address-schema.ts` +
Prisma `Address`/`Order` snapshot) is currently India-only (10-digit phone
regex, 6-digit pincode regex, no `country` field). This work adds a manual,
admin-approved path for international addresses without expanding actual
shipping capability (Sequel247 is India-domestic only).

## Sequel247 API surface (from UAT docs, sequel247.com/api/)

Confirmed by reading the live Apiary-style docs in browser (page is JS-only,
not fetchable headlessly):

- `POST /api/shipment/create` — forward (Ecommerce) booking. Body:
  `token`, `location: "domestic"`, `shipmentType: "D&J"` (Gold/Silver/
  Diamond), `serviceType: "valuable"`, `fromStoreCode` (our store code,
  string), `toAddress` (object: `consignee_name`, `address_line1`,
  `address_line2?`, `pinCode`, `auth_receiver_name`, `auth_receiver_phone`),
  `net_weight`, `gross_weight?`, `net_value`, `codValue?` (max ₹50,000),
  `no_of_packages`, `boxes?`, `invoice?`, `remark?`. Response: `docketNumber`
  (=AWB), `estimated_delivery`, `docket_print` (S3-signed label PDF URL,
  time-limited).
- `POST /api/checkServiceability` — `{token, pin_code}` → on success:
  `{city, state, hub, region, Pickup_Availability, Delivery_Availability}`;
  on failure: `{status:"false", message:"Pincode not found."}`.
- `POST /api/track` — `{token, docket}` → `tracking_events[]` of
  `{description, location, date_time}`.
- Cancel — body shape confirmed (`{token, docket, cancelReason}`) but the
  docs UI showed the *tracking* URL on the cancel example (looks like a
  copy-paste bug in their docs). **Actual cancel path must be verified
  against the UAT server during implementation** — do not trust the docs
  literally here.
- No public customer-facing tracking URL was found in the docs — Sequel247
  doesn't appear to expose one. `ShippingProvider.trackShipment()` still
  works (via `/api/track`), but `ShipmentBooking.trackingUrl` will likely be
  `null`; the existing order page's own timeline covers this the same way
  the `manual` provider does today.

## Changes

### 1. Data model

```prisma
model Address {
  // ...existing fields...
  country String @default("IN") // ISO 3166-1 alpha-2
}

model Order {
  // ...existing snapshot fields (contactName, contactPhone, addressLine1/2,
  // city, state, pincode)...
  country            String  @default("IN")
  intlReviewRequired Boolean @default(false)
  intlReviewApproved Boolean @default(false)
}
```

`pincode`/`city`/`state` remain required, non-empty strings — free-text with
no format enforcement when `country != "IN"` (postal codes aren't universal).
Existing rows backfill via the `@default("IN")` — no data migration script
needed.

### 2. Shared address schema — dedupe

Three independent copies of India-only address validation exist today:
`lib/address-schema.ts` (`addressSchema`, used by `/api/account/addresses`),
`app/api/checkout/route.ts`'s own inline `checkoutSchema`, and the client
`AddressForm` TS type in `app/checkout/page.tsx`. This work consolidates to
one shared schema:

- `lib/address-schema.ts`: `addressSchema` gains `country: z.string().length(2).default("IN")`
  and a `.superRefine` that applies the strict India regexes (`contactPhone`
  10-digit, `pincode` 6-digit) only when `country === "IN"`; otherwise
  `pincode`/`city`/`state` just need to be non-empty strings.
- `app/api/checkout/route.ts` imports and reuses `addressSchema` (extended
  with the checkout-only `promoCode` field via `.extend()`) instead of
  keeping its own duplicate copy.
- `app/checkout/page.tsx`'s `AddressForm`/`EMPTY_ADDRESS`/`SavedAddress`
  types gain `country`, and the form gains a country selector: "India"
  (default) vs "Other / International" (reveals free-text city/state/postal
  code, drops the phone digit-count restriction).

### 3. Sequel247 shipping adapter — `lib/shipping/sequel247.ts`

```
Env:
  SHIPPING_PROVIDER=sequel247
  SEQUEL247_TOKEN=<uat or prod token>
  SEQUEL247_BASE_URL=https://test.sequel247.com | https://sequel247.com
  SEQUEL247_STORE_CODE=HYDVFJ
  SHIPPING_MOCK=true   (existing fixture pattern from shiprocket/dtdc, reused)
```

- `bookShipment(request)` → `POST {BASE_URL}/api/shipment/create` with
  `fromStoreCode: SEQUEL247_STORE_CODE`, `toAddress: {consignee_name:
  request.contactName, address_line1, address_line2, pinCode:
  request.pincode, auth_receiver_name: request.contactName,
  auth_receiver_phone: request.contactPhone}`, `shipmentType: "D&J"`,
  `serviceType: "valuable"`, `net_value: request.declaredValue`,
  `no_of_packages: "1"`. Maps `docketNumber` → `awbCode` and
  `providerShipmentId`; `courierName: "Sequel247"`; `trackingUrl: null`
  (see API surface note above — revisit if a real tracking URL format
  turns up during UAT testing).
- `trackShipment(awbCode)` → `POST {BASE_URL}/api/track {token, docket:
  awbCode}`, maps `tracking_events[]` → `TrackingUpdate[]` (`description`
  → `description`, `date_time` → `timestamp`, a fixed `status` string since
  Sequel247 doesn't send a separate status code in this payload).
- `SHIPPING_MOCK=true` returns deterministic fixtures, same pattern as
  `dtdc.ts`/`shiprocket.ts` — no network call.
- **Only invoked for domestic orders.** `getShippingProvider()` callers that
  care about country (the admin PATCH route) fall back to the `manual`
  provider whenever `order.country !== "IN"`, regardless of
  `SHIPPING_PROVIDER` — Sequel247 cannot fulfill international shipments.

### 4. India address validation — `checkServiceability`

A small helper (co-located in `lib/shipping/sequel247.ts` or a sibling
`lib/shipping/sequel247-validate.ts`), called from `POST
/api/account/addresses` and `POST /api/checkout` whenever `country ===
"IN"`:

- `POST {BASE_URL}/api/checkServiceability {token, pin_code}`.
- Success → cross-check/autofill `city`/`state` against the submitted
  values; mismatch is a soft warning, not a hard block (Sequel's city/state
  naming may differ slightly from what the customer types).
- `"Pincode not found."` → reject with 400 ("Enter a valid pincode").
- **Soft-fail on network error/timeout**: log and skip the check, falling
  back to the existing regex-only validation. Never block a sale because a
  third-party call was slow or down.
- Result cached in-process per pincode (a simple `Map`, process lifetime —
  no new infra) to avoid repeat calls for the same pincode across requests.
- Chosen over a third-party pincode API (e.g. India Post) because it's free,
  needs no new integration, and — unlike a generic pincode validator — also
  confirms Sequel247 can actually *deliver* there, not just that the pincode
  exists.
- UAT/test server responses may be canned/limited test data, not real
  pincode coverage — re-verify behavior once switched to the prod token.

### 5. International order flow

- Checkout and address-book forms: country selector, default India. Picking
  "Other / International" switches the address fields to free-text (no
  regex), phone loses the 10-digit restriction.
- On order creation, `country !== "IN"` → `intlReviewRequired: true` on the
  new `Order` row. Payment proceeds normally (Razorpay/mock) — the order is
  **not** blocked pre-payment.
- New endpoint `app/api/admin/orders/[id]/approve-international/route.ts`
  (POST, admin-only) — sets `intlReviewApproved: true`, appends an
  `OrderEvent` note. Mirrors the existing single-purpose route pattern
  (`refund/route.ts`, `retry-payment/route.ts`, `return-request/route.ts`).
- **Real gate, not just a banner**: in the existing `PATCH
  /api/admin/orders/[id]/route.ts`, when `nextStatus === "PREPARING"` and
  `order.intlReviewRequired && !order.intlReviewApproved`, reject with 409
  (`"International order pending review — approve first"`). This blocks
  fulfillment from starting until an admin has explicitly approved, not just
  seen a dashboard note.
- Admin order detail page: banner + "Approve international order" button
  while `intlReviewRequired && !intlReviewApproved`.
- Shipping for approved international orders always uses the `manual`
  provider (courier/AWB typed by hand) — Sequel247 is never called for
  these regardless of `SHIPPING_PROVIDER`.

## Testing plan (stage only — no push to master)

1. **Domestic (Sequel247, UAT)**: `SHIPPING_PROVIDER=sequel247`,
   `SEQUEL247_TOKEN`/`SEQUEL247_BASE_URL` = UAT values from the eml. Save an
   India address (verify `checkServiceability` call + autofill) → checkout
   → admin marks `PREPARING` → `SHIPPED` (real `bookShipment` call to UAT,
   verify a docket number comes back) → verify `trackShipment` returns
   events.
2. **International**: address book / checkout with a non-IN address (free
   text, no pincode regex) → order lands with `intlReviewRequired: true` →
   verify the admin PATCH to `PREPARING` is rejected with 409 → call
   `approve-international` → verify the same PATCH now succeeds → confirm
   shipping falls back to `manual` (Sequel247 never called).
3. **Payment**: `PAYMENT_GATEWAY=razorpay` with Razorpay **test-mode** keys
   (`rzp_test_...`, free from the Razorpay dashboard — no BIS cert needed,
   that's a live-mode-only requirement) — full checkout → webhook → order
   confirmation loop on stage. Falls back to `PAYMENT_GATEWAY=mock` if test
   keys aren't generated yet.
4. All of the above run against `stage_preprod` / a stage environment with
   stage-only env vars. No production secrets, no push to `master`.

## Open items (verify during implementation, not blocking this design)

- Exact Sequel247 cancel-shipment endpoint path (docs UI bug hid it behind
  the tracking URL in the example).
- Whether Sequel247 exposes any customer-facing tracking URL at all (none
  found in docs — currently designed as `trackingUrl: null`).
- Exact field name for the tracking-events status string
  (`tracking_events[].description`/`date_time` confirmed; no separate status
  enum field was visible in the truncated doc sample — confirm during UAT
  testing).
