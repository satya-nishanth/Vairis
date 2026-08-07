# VAIRIS — Launch-Finish Plan

Goal: production-complete store. Swap in live Razorpay + DTDC/Shiprocket keys → launch same day.
Each stage lands independently, green build + tests after each. Review checkpoint per stage.

---

## Stage 0 — Pricing v2 + product model upgrade (approved scope)

### Money model
- **Deposit model removed.** Customer pays exactly the displayed total. No 105% charge,
  no refundable 5%. Copy sweep: checkout, confirmation, order pages, email, timeline,
  admin refund UI. Legacy `DEPOSIT_REFUNDED` orders stay readable.
- **Value Addition (VA) line — the 5%.** Disclosed line item in the price breakup
  (industry-standard: Tanishq prints "VA" on every estimate). Configurable in admin:
  VA % on gold value (default 5), VA % on stone value (default 5), label editable
  (e.g. "Value Addition"). Same revenue as before; weights/carats shown stay true.
  Hidden weight/carat inflation is excluded permanently — illegal (Legal Metrology,
  BIS hallmark contradiction) and not built in any form.

### Diamond pricing (per-carat, admin-managed)
- New **DiamondRate** table — one row per diamond type, each with TWO per-carat rates:
  *without exchange* and *with exchange*. Seeded per Anil's pricing:
  | Type | Without exchange | With exchange |
  |------|-----------------|---------------|
  | Colourless | ₹21,000/ct | ₹30,000/ct |
  | Special coloured | ₹31,500/ct | ₹45,000/ct |
  Fully editable + extensible (add more types later) at `/admin/settings/pricing`.
- **Exchange choice on PDP** — customer sees both prices, picks with/without exchange
  before add-to-cart. Choice carried on cart item → order item (locked at purchase).

### Product stones (multi-diamond)
- New **ProductStone** rows per product: diamond type + carat weight + optional count +
  optional label ("Centre stone", "Blue accent"). Up to any number (10+ fine).
- Admin ProductForm: stones repeater with per-row live value preview at current rates.
- PDP shows type + carat per stone group (count optional — carat & type always visible).
- Legacy `stoneCharges` on variants keeps working as a flat fallback for old products.

### Sizes
- `ProductVariant.size` already in schema — now exposed: admin form size field per
  variant row (metal + size + gold weight per size), PDP gets metal selector + size
  selector; price recomputes from the selected size's gold weight.

### Product status
- New **ProductStatus**: `DRAFT` / `AI_DRAFT` / `LIVE` (replaces implicit isActive-only).
  Admin products table shows labeled badge per row. Storefront shows only LIVE.
- Draft validation relaxed: only title required for DRAFT / AI_DRAFT; full validation
  enforced on switch to LIVE.

### Formula (v2)
```
goldValue  = weight(size) × goldRatePerGram
goldVA     = goldValue × vaGoldPct
making     = weight × makingChargePerGram + flatMakingCharge
stoneValue = Σ stones(carat × DiamondRate[type][exchange?]) + legacy stoneCharges
stoneVA    = stoneValue × vaStonePct
GST        = (goldValue + goldVA + stoneValue + stoneVA) × 3% + making × 5%
total      = goldValue + goldVA + making + stoneValue + stoneVA + misc + GST
```
Breakup shown on PDP (expandable), checkout, order page, email.

### DB migration
`ProductStatus` enum, `Product.status`, `DiamondRate`, `ProductStone`, `PricingSettings`,
`CartItem.withExchange`, `OrderItem.withExchange`. Backfill: `isActive=true → LIVE`,
else `DRAFT`. Seed DiamondRate rows + PricingSettings singleton.

---

## Stage 1 — Payment + shipping mocks (launch-key-swap ready)

- **Mock payment gateway** implementing `lib/payments` port: `PAYMENT_GATEWAY=mock`.
  Deterministic flows: success / failure / abandoned / refund. Mock checkout modal page
  (test-mode only) so UI e2e can complete real order lifecycles. Webhook self-POST with
  valid HMAC so the production webhook path is exercised, not bypassed.
- **Shiprocket adapter** (`lib/shipping/shiprocket.ts`) against real API shapes
  (auth token, create order, generate AWB, track, cancel) + `SHIPPING_MOCK=true` fixture mode.
- **DTDC adapter** (`lib/shipping/dtdc.ts`) same pattern.
- Tracking webhook/poll endpoint updating `Shipment.status` → order status transitions.
- Env-only swap to production: set real keys, unset mock flags. Zero code change.

## Stage 2 — Commerce gaps

- Address book (schema exists; CRUD + select at checkout + default).
- Search: server route + header UI (name, category, item code, style), debounced, keyboard nav.
- Promo codes: `PromoCode` table (percent/flat, min order, window, usage caps), cart apply,
  admin CRUD. Wired to the existing cart promo field.
- Contact form backend (`ContactRequest` table + Resend notify) — kills fake success.
- Customer order cancellation (pre-ship, self-serve, auto full refund).
- Admin dashboard stats: orders today/week, revenue, pending refunds, low stock, top products.

## Stage 3 — Reviews & ratings

- `Review` table: rating, title, body, photos (Supabase storage), verified-purchase flag
  (only delivered orders can review), admin moderation (approve/hide/reply).
- PDP: summary histogram, sorted list, photo lightbox. Real aggregates in JSON-LD.
- **Remove fake claims** ("10,000+ women", "4.9 (2,300+ reviews)") — replaced by real aggregates
  (hidden until N≥1). Post-delivery review-request email.

## Stage 4 — CMS / merchandising flexibility (Tanishq / CaratLane / Mejuri patterns)

Extend `SiteBanner`/site-content system into block-based CMS:
- Home composed of ordered, admin-managed sections: hero carousel, category tiles, collection
  rails, editorial banner (image+copy+CTA), video block, testimonial rail, USP strip, Instagram
  strip. Add/remove/reorder/toggle from admin, per-section scheduling (start/end).
- **Collections**: named curated product sets (e.g. "Bridal Edit", "Everyday Diamonds") with
  own landing page, hero, SEO copy; attachable to nav + home rails.
- Announcement/promo bar: multiple rotating messages, scheduling.
- Nav mega-menu config (admin-ordered categories + collections + imagery).
- PLP: admin-set category hero, sort options (price, newest, popularity), filters
  (metal, price band, stone) — server-driven.
- Size guide, gold-rate ticker (live board rate strip), store-policy blocks — all editable.

## Stage 5 — Analytics

- GA4 e-commerce events (view_item, add_to_cart, begin_checkout, purchase, refund) via
  first-party event layer; Vercel Analytics stays.
- Internal `AnalyticsEvent` table (page views, PDP views, add-to-carts, searches) —
  admin analytics page: funnel, conversion, top searches (incl. zero-result), top products.
- Razorpay/refund reconciliation view (ledger already exists).

## Stage 6 — Platform hardening + polish

- SEO: sitemap.xml, robots.txt, canonical, OpenGraph, JSON-LD (Organization, Product w/ price
  + availability + ratings, BreadcrumbList).
- Email redesign: branded templates (confirmation, shipped w/ tracking, delivered, refund,
  review request, contact ack) — dark/light safe, consistent with site type system.
- Rate limiting middleware (track-order, auth, contact, reviews, search).
- Error tracking: Sentry (free tier) server+client.
- Legal pages: Privacy, Terms, Shipping, Refund/Return policy (Razorpay LIVE requires
  refund policy URL) — content editable via CMS blocks.
- GitHub Actions: gold-rate cron + order sweep cron workflows (committed, need repo secrets).
- Accessibility + Lighthouse pass (target 90+ perf/SEO/a11y on home, PLP, PDP).

## Stage 7 — E2E (Playwright API + UI, Chrome visual pass)

- **API suites**: checkout→payment(mock)→webhook→confirm; failure/retry/expiry-sweep;
  cancel+refund; delivery fail→RTO→re-dispatch; returns request→approve→QC→refund;
  split orders; promo codes; reviews gating; rate limits; auth/authz matrix (admin routes
  reject non-admin), enumeration safety.
- **UI suites**: full purchase journey via mock modal; address book; search; wishlist⇄cart;
  promo apply; order tracking; review submission; admin: product CRUD, order transitions,
  refund click, CMS section editing reflected on storefront; theme (light/dark) smoke.
- **Chrome-tool visual pass**: manual-grade walkthrough of every page both themes,
  mobile + desktop viewports, screenshot record (GIF) for review.
- CI: `npm run lint && tsc && build && jest && playwright` — all green gate.

---

## Launch checklist delta (post-plan)

Everything in `docs/LAUNCH.md` stays valid. After all stages: set live Razorpay keys +
webhook, choose `SHIPPING_PROVIDER=shiprocket|dtdc` + keys, Resend domain, GA4 id,
Sentry DSN, run prod migrations, flip `NEXT_PUBLIC_CHECKOUT_ENABLED=true`.

## Known follow-up (not blocking launch)

- `sharp` pinned at 0.34.5 (libvips CVE fix ships in 0.35+) — 0.35.x uses ESM
  import-attribute syntax that breaks the Turbopack build on Node 20.9.
  Bump Node to 20.10+/22 LTS, then `npm install sharp@latest` and rebuild.
  Low real exposure today: sharp only runs in `/api/admin/upload` (admin-only,
  requireAdmin-gated) and local scripts — never on public/unauthenticated input.

## Order of execution

0 → 1 → 2 → 3 → 4 → 5 → 6 → 7. Migrations at stages 0, 2, 3, 4, 5.
Each stage: code + unit tests + doc update + lint/build green, then checkpoint.
