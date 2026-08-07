# VAIRIS — Feature Inventory

Status legend: ✅ live & verified · 🟡 built, needs external config · ⏳ planned/pending

## Storefront

| Feature | Status | Notes |
|---------|--------|-------|
| Home page (hero, categories, best sellers, testimonials, videos) | ✅ | Hero + promo bar admin-customizable; admin-managed sections render below hero (`/admin/sections`) |
| Category pages `/all-products/[category]` (rings, earrings, pendants, bracelets, necklaces) | ✅ | DB-backed only; curated empty state when no products; real filters (metal/style/ready-to-ship) + sort + pagination |
| Collections `/collections/[slug]` | ✅ | Curated product edits with own landing page, hero, SEO copy; `/admin/collections`; optional nav pin |
| Product detail page (gallery incl. video, variant selector, live gold-rate pricing) | ✅ | Sticky gallery, mobile swipe + sticky buy bar, size selector, metal selector |
| Multi-diamond products with per-carat pricing | ✅ | Any number of stones per product (type + carat, count/label optional); with/without-exchange toggle on PDP |
| GST-correct dynamic pricing from live gold rates + disclosed Value Addition | ✅ | `lib/pricing.ts` — locked formula; VA % (gold + stone) admin-editable at `/admin/settings/pricing`, always shown as its own breakup line |
| Live search | ✅ | `/api/search`; debounced results in header overlay, zero-result queries logged for merchandising |
| Light/dark theme | ✅ | Token CSS system, audited both themes |
| Wishlist (guest localStorage + synced server-side when logged in) | ✅ | |
| Cart (add/qty/remove, live badge, PLP Quick Add, login-gated, exchange choice) | ✅ | Behind `NEXT_PUBLIC_CHECKOUT_ENABLED` |
| Product reviews (rating, title, body, verified-purchase badge) | ✅ | `/admin/reviews` moderation; PDP histogram + list; JSON-LD `aggregateRating` |

## Checkout & Orders

| Feature | Status | Notes |
|---------|--------|-------|
| Checkout (address book, promo code, order summary) | ✅ | Behind `NEXT_PUBLIC_CHECKOUT_ENABLED`; saved addresses + "save this address"; disabled pages show WhatsApp ordering notice |
| Money model: customer pays exactly the displayed total | ✅ | `lib/orders.ts`; legacy 105%/5% deposit model retired — `DEPOSIT_REFUNDED` kept readable for historical orders only |
| Address book | ✅ | `/api/account/addresses`; multiple saved addresses, default flagging |
| Promo codes (percent / flat, min order, caps, per-user limits, scheduling) | ✅ | `/admin/promos`; server-validated at checkout, ledgered in `PromoRedemption`, released on expiry/cancel |
| Payment gateway: Razorpay adapter | 🟡 | Code complete + webhook-tested; needs live API keys at launch |
| Payment gateway: **Mock adapter** (`PAYMENT_GATEWAY=mock`) | ✅ | Full lifecycle without keys — `/mock-pay` modal, HMAC-signed self-webhooks through the real webhook route; guarded off on Vercel production unless `ALLOW_MOCK_PAYMENTS=true` |
| Payment webhooks (captured/failed/refunded — idempotent, HMAC-verified) | ✅ | Works identically for Razorpay and mock |
| Order confirmation page + email | ✅ | Branded HTML email (Resend); needs `RESEND_API_KEY` |
| Shipped / Delivered transactional emails | ✅ | Shipped includes courier+AWB+tracking link; Delivered includes a review-request CTA |
| My Orders + order detail with visual status timeline | ✅ | |
| Public order tracking (order ID + email, no login) | ✅ | Enumeration-safe, rate-limited |
| Customer self-serve cancellation (pre-dispatch) | ✅ | `/api/orders/[id]/cancel`; automatic full refund on paid orders |
| Deposit refund after delivery (partial gateway refund) | 🟡 | Legacy orders only; needs Razorpay keys |
| Full refund on cancellation | ✅ | Automatic via mock or Razorpay once keys are live |
| Refund ledger (`OrderRefund`) — declared intent, gateway + offline, webhook-matched completion | ✅ | `lib/refunds.ts`; every rupee returned is a row |
| Payment retry (same order, same locked price) + expiry sweep | ✅ | `/api/orders/[id]/retry-payment`, `/api/admin/sweep-orders` (also releases reserved promo codes) |
| Failed-delivery handling (retry attempt, RTO, RTO re-dispatch) | ✅ | Unchanged from v1 |
| Customer returns (self-serve request within window, admin approve/reject, QC pass/fail) | ✅ | Unchanged from v1 |
| Order notes (internal admin notes vs customer-visible) | ✅ | |
| Auto-split multi-item orders into per-item deliveries | ✅ | Unchanged from v1 |
| Shipping: Manual, **Shiprocket**, **DTDC** adapters | ✅ | `SHIPPING_PROVIDER=manual\|shiprocket\|dtdc`; `SHIPPING_MOCK=true` gives keyless fixtures for dev/e2e; admin ship action auto-books when a real/mock provider is active |
| EMI / offers | ⏳ | Promo codes now live; EMI still not built |

## Auth & Account

| Feature | Status | Notes |
|---------|--------|-------|
| Email/password sign up + sign in (Supabase) | ✅ | |
| Google OAuth | ✅ | Needs prod redirect URL at launch |
| Forgot / reset password | ✅ | |
| Account page (profile, order count, wishlist count) | ✅ | |
| Address book | ✅ | See Checkout & Orders |

## Admin (`/admin`, gated by `ADMIN_EMAILS`)

| Feature | Status | Notes |
|---------|--------|-------|
| Product CRUD (variants incl. size, diamonds, status DRAFT/AI_DRAFT/LIVE) | ✅ | Draft/AI Draft only require a title; going LIVE enforces ≥1 variant; live price estimate incl. VA + diamonds |
| Pricing settings (VA %, diamond per-carat rates with/without exchange) | ✅ | `/admin/settings/pricing` |
| Collections manager | ✅ | `/admin/collections` |
| Home sections manager (ordered, schedulable blocks) | ✅ | `/admin/sections` — collection rail, editorial banner, video, USP strip |
| Order management (filterable list, guarded status transitions, manual shipping entry, auto-booking) | ✅ | |
| Manual order entry for WhatsApp/offline sales | ✅ | /admin/orders/new |
| Refund buttons (deposit legacy / full) | 🟡 | Needs Razorpay keys (mock works today) |
| Site content editor (promo bar w/ rotating messages, home hero, category heroes) | ✅ | |
| Promo codes manager | ✅ | `/admin/promos` |
| Reviews moderation (approve/hide, public reply) | ✅ | `/admin/reviews` |
| Contact requests inbox | ✅ | `/admin/contacts` |
| Gold rate sync endpoint (Bearer-secret, rate-limited) | 🟡 | Needs GitHub Actions cron (workflow committed) + `METAL_PRICE_API_KEY` |
| Dashboard order/revenue/ops stats | ✅ | Orders today/week, revenue, pending refunds, low stock, open returns, new contact requests, pending reviews |
| Analytics dashboard | ✅ | `/admin/analytics` — funnel, conversion, top viewed/carted products, top + zero-result searches |

## Platform & Quality

| Feature | Status | Notes |
|---------|--------|-------|
| Swappable payment gateway port (`lib/payments`) | ✅ | Razorpay + Mock adapters; add adapter + env to swap |
| Swappable shipping provider port (`lib/shipping`) | ✅ | Manual, Shiprocket, DTDC adapters |
| ESLint (zero findings) + TypeScript strict passes | ✅ | `npm run lint` |
| First-party analytics (`AnalyticsEvent`) + optional GA4 mirror | ✅ | `NEXT_PUBLIC_GA_ID` to enable GA4 |
| Error tracking (Sentry) | 🟡 | `@sentry/nextjs` wired (server/edge/client), no-op until `SENTRY_DSN` set |
| Rate limiting on public APIs | ✅ | track-order, contact, search, promo validate, reviews |
| SEO: sitemap.xml, robots.txt, per-product JSON-LD (Product + AggregateRating) | ✅ | |
| Legal pages: Privacy, Terms, Shipping, Refund & Return | ✅ | `/policies/*`, linked in footer |
| Transactional email infra | 🟡 | Resend; branded templates (confirmed/shipped/delivered); needs domain verification |
| GitHub Actions: gold-rate sync + order expiry sweep | ✅ | `.github/workflows/*.yml` — need repo secrets `APP_URL`, `GOLD_SYNC_SECRET`, `ORDER_SWEEP_SECRET` |
| Contact form backend | ✅ | `/api/contact` — stores `ContactRequest` + best-effort email notify |
| WhatsApp bot (Python service) | ⏳ | Future phase (P10) |
