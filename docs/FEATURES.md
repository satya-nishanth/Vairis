# VAIRIS — Feature Inventory

Status legend: ✅ live & verified · 🟡 built, needs external config · ⏳ planned/pending

## Storefront

| Feature | Status | Notes |
|---------|--------|-------|
| Home page (hero, categories, best sellers, testimonials, videos) | ✅ | Hero + promo bar admin-customizable |
| Category pages `/all-products/[category]` (rings, earrings, pendants, bracelets, necklaces) | ✅ | DB-backed only; curated empty state when no products; filters + pagination |
| Product detail page (gallery incl. video, variant selector, live gold-rate pricing) | ✅ | Sticky gallery, mobile swipe + sticky buy bar |
| GST-correct dynamic pricing from live gold rates | ✅ | `lib/pricing.ts` — locked formula |
| Light/dark theme | ✅ | Token CSS system, audited both themes |
| Search | ⏳ | Header button is UI-only |
| Wishlist (guest localStorage + synced server-side when logged in) | ✅ | |
| Cart (add/qty/remove, live badge, PLP Quick Add, login-gated) | ✅ | Behind `NEXT_PUBLIC_CHECKOUT_ENABLED` (off until Razorpay live — storefront runs WhatsApp-enquiry mode) |

## Checkout & Orders

| Feature | Status | Notes |
|---------|--------|-------|
| Checkout (address form, order summary) | ✅ | Behind `NEXT_PUBLIC_CHECKOUT_ENABLED`; disabled pages show WhatsApp ordering notice |
| **105% payment / 5% refundable security deposit model** | ✅ | `lib/orders.ts`; explained at checkout, confirmation, order page, email |
| Razorpay payment (UPI/cards/netbanking) | 🟡 | Code complete + webhook-tested; needs API keys (`docs/LAUNCH.md` §1) |
| Payment webhooks (captured/failed/refunded — idempotent, HMAC-verified) | ✅ | Simulated-webhook test suite green |
| Order confirmation page + email | ✅ | Email needs `RESEND_API_KEY`; template minimal (P8 redesign) |
| My Orders + order detail with visual status timeline | ✅ | |
| Public order tracking (order ID + email, no login) | ✅ | Enumeration-safe |
| Deposit refund after delivery (partial gateway refund) | 🟡 | One admin click; needs Razorpay keys |
| Full refund on cancellation | 🟡 | Same |
| Refund ledger (`OrderRefund`) — declared intent, gateway + offline, webhook-matched completion | ✅ | `lib/refunds.ts`; every rupee returned is a row |
| Payment retry (same order, same locked price) + expiry sweep | ✅ | `/api/orders/[id]/retry-payment`, `/api/admin/sweep-orders` — race-safe against late webhook capture |
| Failed-delivery handling (retry attempt, RTO, RTO re-dispatch) | ✅ | `DELIVERY_FAILED → OUT_FOR_DELIVERY` retry or `→ RETURNING_TO_ORIGIN → RTO_RECEIVED → PREPARING` re-dispatch; re-dispatch creates a fresh `Shipment` row |
| Customer returns (self-serve request within window, admin approve/reject, QC pass/fail) | ✅ | `/api/orders/[id]/return-request`; window = `RETURN_WINDOW_DAYS`; reject reverts to exact prior status; QC-fail requires a reason note |
| Order notes (internal admin notes vs customer-visible) | ✅ | `/api/admin/orders/[id]/notes`; internal notes never reach customer surfaces |
| Auto-split multi-item orders into per-item deliveries, payment-anchored to the parent | ✅ | `lib/split.ts`; proration exact, refunds resolve from the individual delivery |
| Shipping partner integration | ⏳ | Partner undecided; manual courier/AWB entry works today (`lib/shipping` port ready) |
| EMI / offers / promo codes | ⏳ | Promo field UI exists on cart, no backend |

## Auth & Account

| Feature | Status | Notes |
|---------|--------|-------|
| Email/password sign up + sign in (Supabase) | ✅ | |
| Google OAuth | ✅ | Needs prod redirect URL at launch |
| Forgot / reset password | ✅ | |
| Account page (profile, order count, wishlist count) | ✅ | |
| Address book | ⏳ | Schema exists (`Address`), address re-entered each checkout |

## Admin (`/admin`, gated by `ADMIN_EMAILS`)

| Feature | Status | Notes |
|---------|--------|-------|
| Product CRUD (variants, pricing helper with live estimate, image/video slots) | ✅ | |
| Order management (filterable list, guarded status transitions, manual shipping entry) | ✅ | |
| Manual order entry for WhatsApp/offline sales (customer search, negotiated prices, optional deposit, offline settlement marks) | ✅ | /admin/orders/new |
| Refund buttons (5% deposit / full) | 🟡 | Needs Razorpay keys |
| Site content editor (promo bar, home hero, category heroes) with image upload | ✅ | Fallback-safe; extend via `lib/site-content.ts` KNOWN_SLOTS |
| Gold rate sync endpoint (Bearer-secret, rate-limited) | 🟡 | Needs GitHub Actions cron + `METAL_PRICE_API_KEY` |
| Dashboard order/revenue stats | ⏳ | Dashboard exists, order stats not wired |

## Platform & Quality

| Feature | Status | Notes |
|---------|--------|-------|
| Swappable payment gateway port (`lib/payments`) | ✅ | Razorpay adapter today; add adapter + env to swap |
| Swappable shipping provider port (`lib/shipping`) | ✅ | Manual today; Shiprocket-ready interface |
| ESLint (zero findings) + TypeScript strict passes | ✅ | `npm run lint` |
| Test suites: storefront flow (14), order lifecycle v2 (70 scenarios), route crawler | ✅ | `scripts/_flow-test.mjs`, `_order-lifecycle-test.mjs`, `_crawl.mjs` |
| Transactional email infra | 🟡 | Resend; needs domain verification |
| SEO (sitemap, robots, JSON-LD) | ⏳ | Roadmap P7 |
| Error tracking / monitoring | ⏳ | Vercel Analytics only |
| Rate limiting on public APIs | ⏳ | |
| Contact form backend | ⏳ | UI shows fake success — fix before launch |
| WhatsApp bot (Python service) | ⏳ | Future phase (P10) |
