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

### `POST /api/track-order` 🌐
Public tracking: requires order id AND purchase email (identical 404 for wrong id or wrong email — no enumeration). Response intentionally excludes amounts/address.
- Body: `{ orderId, email }`
- 200 → `{ orderId, status, placedAt, events[], shipment: { courierName, awbCode, trackingUrl } | null }`

*(Customer order list/detail are server-rendered pages — `/account/orders[/id]` — not JSON APIs.)*

## Admin — Orders 🔐

### `GET /api/admin/orders`
- Query: `status` (OrderStatus) — omit for all. 200 → orders with items, payment, user. Max 200 rows.

### `PATCH /api/admin/orders/[id]`
Guarded status transition (valid moves: `lib/orders.ts` `ADMIN_TRANSITIONS`; webhook-owned transitions rejected here).
- Body: `{ status: PROCESSING|SHIPPED|DELIVERED|CANCELLED, note?, courierName?, awbCode?, trackingUrl? }`
- `SHIPPED` requires `courierName` + `awbCode` while the manual shipping provider is active
- Every transition appends an `OrderEvent` (customer timeline)
- 200 · 400 missing shipping fields · 409 illegal transition

### `POST /api/admin/orders/[id]/refund`
Initiate a gateway refund. Status flips only when `refund.processed` webhook lands.
- Body: `{ type: "deposit" | "full" }`
  - `deposit` — 5% security deposit; order must be `DELIVERED`, not already refunded
  - `full` — remaining captured amount; only `PAYMENT_CONFIRMED|PROCESSING|CANCELLED`
- 200 `{ ok, amount }` · 409 wrong state · 503 gateway not configured · 502 gateway refused

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

### `GET /api/auth/callback` 🌐
Supabase OAuth/PKCE redirect handler (Google sign-in, email links). Redirects to `?next=` or `/`.

---

## Extending

- **New payment gateway:** implement `PaymentGateway` (`lib/payments/types.ts`), register in `lib/payments/index.ts`, set `PAYMENT_GATEWAY`. No route changes.
- **New shipping partner:** implement `ShippingProvider` (`lib/shipping/types.ts`), register, set `SHIPPING_PROVIDER`. Admin UI switches from manual fields to API booking via `supportsBooking`.
- **New banner surface:** add slot to `KNOWN_SLOTS`, call `getBanner(slot)` server-side (or `/api/content/[slot]` from client components), spread over built-in defaults.
