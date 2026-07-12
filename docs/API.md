# VAIRIS — API Reference

All routes are Next.js route handlers under `/api`, `force-dynamic`, JSON in/out unless noted.

**Auth levels**
- 🌐 **Public** — no auth
- 👤 **Customer** — Supabase session cookie required (`requireUser`); 401/redirect otherwise
- 🔐 **Admin** — session email must be in `ADMIN_EMAILS` (`requireAdmin`)
- 🤖 **Machine** — signature/secret header, no session

Errors are `{ "error": string, "message"?: string }` with conventional status codes
(400 validation, 401/403 auth, 404 not found, 409 state conflict, 429 rate limit, 5xx upstream).

---

## Catalog

### `GET /api/products` 🌐
List active products.
- Query: `category` (Prisma enum: `RINGS|EARRINGS|PENDANTS|BRACELETS|NECKLACES`), `search` (name substring)
- 200 → `Product[]` with `variants[]`

### `GET /api/products/[id]` 🌐
Single active product with variants. 404 if missing/inactive.

### `GET /api/gold-rates` 🌐
Current gold rates for price display.
- 200 → `{ rates: { "18K": number, "14K": number }, unit: "₹/gram", fetchedAt: ISO }`
- 503 when no rate has ever been synced

## Cart 👤

### `GET /api/cart`
User's cart lines, each priced server-side at current gold rates.
- 200 → `CartLine[]`: `{ id, variantId, quantity, unitPrice, variant: { …, product } }`

### `POST /api/cart`
Add item (upsert; increments quantity if the variant is already in the cart).
- Body: `{ variantId: string, quantity: number }`
- 201 → cart item

### `PATCH /api/cart/[itemId]`
Set quantity. Body: `{ quantity: number }` → 200.

### `DELETE /api/cart/[itemId]`
Remove line → 204.

## Wishlist 👤

### `GET /api/wishlist`
- 200 → `{ productId, product: { id, name, category, images, comingSoon } }[]`

### `POST /api/wishlist`
Add (idempotent upsert). Body: `{ productId }` → 201. 404 if product missing/inactive.

### `DELETE /api/wishlist?productId=…`
Remove → 204.

## Checkout & Payment

### `POST /api/checkout` 👤
Create an Order from the cart + a gateway payment intent.
Prices recomputed server-side; client amounts never trusted.
**Money model:** captures `grandTotal` = 105% of goods total; 5% deposit refunded after delivery (`lib/orders.ts`).
- Body: `{ contactName, contactPhone(10d), addressLine1, addressLine2?, city, state, pincode(6d) }`
- 200 → `{ orderId, gateway, clientParams, contact }` — `clientParams` is passed verbatim to the gateway's browser SDK
- 400 `VALIDATION` / `EMPTY_CART` · **503 `PAYMENTS_NOT_CONFIGURED`** (gateway keys missing — expected pre-launch) · 502 `GATEWAY`

### `POST /api/payment/verify` 👤
Browser-side proof-of-payment from the gateway SDK success handler.
Idempotent with the webhook (whichever lands first confirms the order, clears the cart, sends the email).
- Body: `{ gatewayOrderId, gatewayPaymentId, signature }`
- 200 → `{ ok: true, orderId }` · 400 invalid signature · 404 not caller's order

### `POST /api/webhooks/payment` 🤖
Gateway-agnostic webhook endpoint (register THIS path with the gateway — currently Razorpay:
events `payment.captured`, `payment.failed`, `refund.processed`; header `x-razorpay-signature`,
HMAC-SHA256 of the raw body with `RAZORPAY_WEBHOOK_SECRET`).
Handlers are idempotent; refunds distinguish 5%-deposit vs full by cumulative amount.
- 200 `{ ok: true }` (also for ignored event types) · 400 invalid signature
- Local simulation: `node scripts/_simulate-webhook.mjs captured|failed|refund …`

## Orders

Full v2 lifecycle — 18 `OrderStatus` values (`lib/orders.ts`):
`PAYMENT_PENDING, PAYMENT_EXPIRED, PAYMENT_CONFIRMED, PREPARING, SHIPPED, OUT_FOR_DELIVERY,
DELIVERY_FAILED, RETURNING_TO_ORIGIN, RTO_RECEIVED, DELIVERED, DEPOSIT_REFUNDED,
RETURN_REQUESTED, RETURN_IN_TRANSIT, RETURN_RECEIVED, CANCELLED, REFUNDED,
SPLIT_INTO_DELIVERIES, FAILED_OTHER`.
Valid admin transitions live in `ADMIN_TRANSITIONS` (+ `OFFLINE_SETTLEMENT_TRANSITIONS` for
orders with no gateway `Payment`); transitions requiring a reason `note` are listed in
`REASON_REQUIRED` / `REASON_REQUIRED_TARGETS` (e.g. any transition into `FAILED_OTHER`, or
`SHIPPED|OUT_FOR_DELIVERY → DELIVERY_FAILED`).

Multi-item orders auto-split atomically into one child `Order` per line item (`SPLIT_INTO_DELIVERIES`
on the parent) — see `lib/split.ts`. The parent's gateway `Payment` is shared by all children
(payment anchoring); refunds are always initiated from an individual child, never the parent.

### `POST /api/track-order` 🌐
Public tracking: requires order id AND purchase email (identical 404 for wrong id or wrong email — no enumeration). Response intentionally excludes amounts/address.
- Body: `{ orderId, email }`
- 200 → `{ orderId, status, placedAt, events[], notes: { body, createdAt }[], shipment: { courierName, awbCode, trackingUrl } | null, children?: [...] }`
  - `notes` only ever includes customer-visible (`internal: false`) notes — internal notes never serialize into this response
  - `children` is present only when the order is a split parent (`SPLIT_INTO_DELIVERIES`) — one summary object per delivery, same shape (`orderId, status, events, notes, shipment`)

### `POST /api/orders/[id]/retry-payment` 👤
Relaunch the gateway checkout for the caller's own `PAYMENT_PENDING` order — reuses the original
gateway order id (price stays locked), bounded by the expiry sweep.
- 200 → `{ orderId, gateway, clientParams, contact }` (same `clientParams` shape as `/api/checkout`)
- 404 not caller's order · 409 order not awaiting payment · 503 `PAYMENTS_NOT_CONFIGURED`

### `POST /api/orders/[id]/return-request` 👤
Customer-initiated return ("Easy Returns"). Order must be `DELIVERED` or `DEPOSIT_REFUNDED` and
within `RETURN_WINDOW_DAYS` (default 7) of the `DELIVERED` event → moves to `RETURN_REQUESTED`.
Admin approves (`RETURN_IN_TRANSIT`) or rejects (reverts to the exact prior status) via the admin
PATCH endpoint below.
- Body: `{ reason }` (min 5 chars)
- 200 `{ ok: true }` · 400 missing/short reason · 404 not caller's order · 409 not eligible
  (wrong status — including a second request on an already-`RETURN_REQUESTED` order — or outside the return window)

*(Customer order list/detail are server-rendered pages — `/account/orders[/id]` — not JSON APIs.)*

## Admin — Orders 🔐

### `GET /api/admin/orders`
- Query: `status` (OrderStatus) — omit for all. 200 → orders with items, payment, user. Max 200 rows.

### `PATCH /api/admin/orders/[id]`
Guarded status transition (valid moves: `lib/orders.ts` `ADMIN_TRANSITIONS` + `OFFLINE_SETTLEMENT_TRANSITIONS`; webhook-owned transitions rejected here).
- Body: `{ status: OrderStatus, note?, courierName?, awbCode?, trackingUrl? }`
- `SHIPPED` requires `courierName` + `awbCode` while the manual shipping provider is active — creates a new `Shipment` row every time (re-dispatch after RTO/QC-fail shows up as a second row)
- `note` is required (400 without) for transitions in `REASON_REQUIRED` / any transition into `FAILED_OTHER`
- Rejecting a `RETURN_REQUESTED` order (→ `DELIVERED` or `DEPOSIT_REFUNDED`) must target the exact status the order held before the return request — 409 otherwise
- Every transition appends an `OrderEvent` (customer timeline)
- 200 · 400 missing shipping fields / missing reason note · 409 illegal transition or wrong revert target

### `POST /api/admin/orders/[id]/refund`
Initiate a refund via the ledger (`lib/refunds.ts`). Gateway refunds complete when the
`refund.processed` webhook lands; orders with no gateway `Payment` (offline/manual orders) are
marked `COMPLETED` immediately and the order status flips synchronously.
- Body: `{ kind: "deposit" | "full" | "partial", amount?, reason }`
  - `deposit` — 5% security deposit; order must be `DELIVERED`, not already refunded → `DEPOSIT_REFUNDED`
  - `full` — remaining captured amount → `REFUNDED`
  - `partial` — `amount` required; only settles the order (→ `REFUNDED`) when current status is `CANCELLED`, `RETURN_RECEIVED`, or `FAILED_OTHER`
  - `amount` required for `partial`, ignored otherwise; `reason` always required (min 3 chars)
- Every refund creates an `OrderRefund` ledger row (`amount, kind, method: GATEWAY|OFFLINE, status`)
- 200 `{ ok, amount }` · 400 invalid body · 409 wrong state / exceeds remaining / split parent (refund from the child delivery instead) · 503 gateway not configured · 502 gateway refused

### `POST /api/admin/orders/[id]/notes`
Add a note to an order (author = admin session email).
- Body: `{ body (1-2000 chars), internal?: boolean }` — `internal` defaults `true`; only `internal: false` notes ever appear on customer surfaces (order page, track-order)
- 201 → created `OrderNote` · 400 missing/empty body · 404 order not found

### `PATCH /api/admin/orders/[id]/notes/[noteId]`
Toggle a note's visibility.
- Body: `{ internal: boolean }`
- 200 → updated `OrderNote` · 400 missing field · 404 note not found (or belongs to a different order)

## Admin — Products 🔐

### `GET /api/admin/products` · `POST /api/admin/products`
List all (incl. inactive) / create with variants. POST body mirrors the ProductForm shape
(name, category, itemCode, spec fields, `images[]`, `variants[]` with pricing inputs, isActive, comingSoon).

### `GET | PATCH | DELETE /api/admin/products/[id]`
Read / update (variants replaced wholesale) / delete.

### `POST /api/admin/upload`
`multipart/form-data`, field `file`. Images auto-resized to 1200px (sharp) and stored in
Supabase storage; videos ≤50MB. 200 → `{ url }`. Shared by product images AND banner images.

## Admin — Site Content 🔐

### `GET /api/admin/content/[slot]`
Current banner row (even inactive) for the edit form. Slots allow-listed in `lib/site-content.ts` `KNOWN_SLOTS`.

### `PUT /api/admin/content/[slot]`
Upsert. Empty string clears a field (storefront falls back to built-in copy); `active:false` disables without deleting.
- Body: `{ title?, subtitle?, imageUrl?, linkUrl?, ctaLabel?, active: boolean }`

### `GET /api/content/[slot]` 🌐
Public read for client components (PromoBar). 200 → `{ banner: Banner | null }`, edge-cached 60s. Unknown slot → 404.

## Machine / Ops

### `POST /api/admin/sync-gold-rate` 🤖
Fetch live gold price → update `GoldRate` rows. Called by the GitHub Actions cron (never Vercel cron).
- Header: `Authorization: Bearer $GOLD_SYNC_SECRET`
- 200 rates updated · 401 bad/missing secret · 429 if synced < 30 min ago

### `POST /api/admin/sweep-orders` 🤖
Expire stale unpaid orders — `PAYMENT_PENDING` older than `ORDER_EXPIRY_HOURS` (default 24) with no
`CAPTURED` payment → `PAYMENT_EXPIRED`. Race-safe by construction: the update re-checks status +
payment state at write time, so an order whose payment lands `CAPTURED` between the scan and the
write is skipped, never clobbered. Called by the GitHub Actions hourly cron (never Vercel cron).
- Header: `Authorization: Bearer $ORDER_SWEEP_SECRET`
- 200 → `{ ok: true, checked, expired }` · 401 bad/missing secret

### `GET /api/auth/callback` 🌐
Supabase OAuth/PKCE redirect handler (Google sign-in, email links). Redirects to `?next=` or `/`.

---

## Extending

- **New payment gateway:** implement `PaymentGateway` (`lib/payments/types.ts`), register in `lib/payments/index.ts`, set `PAYMENT_GATEWAY`. No route changes.
- **New shipping partner:** implement `ShippingProvider` (`lib/shipping/types.ts`), register, set `SHIPPING_PROVIDER`. Admin UI switches from manual fields to API booking via `supportsBooking`.
- **New banner surface:** add slot to `KNOWN_SLOTS`, call `getBanner(slot)` server-side (or `/api/content/[slot]` from client components), spread over built-in defaults.
