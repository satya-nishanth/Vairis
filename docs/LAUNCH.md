# VAIRIS — Launch Roadmap

Everything between the current state (branch `order-flow`) and a live, top-tier store.
Work through the sections in order; each item says who acts and where.

---

## 1. Environment variables — complete reference

Set in `.env.local` for dev; in **Vercel → Project → Settings → Environment Variables** for prod
(remember: `NEXT_PUBLIC_*` need "All Environments" checked explicitly).

### Database (Supabase / Prisma)
| Key | Value | Notes |
|-----|-------|-------|
| `DATABASE_URL` | Session Pooler URL `aws-1-ap-south-1.pooler.supabase.com:5432` | **Never** port 6543 (Transaction Pooler breaks Prisma prepared statements) |
| `DIRECT_DATABASE_URL` | Direct connection URL | Used by Prisma migrations only |

### Supabase (auth + storage)
| Key | Value | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ohnydotpayefvaurtiyy.supabase.co` (prod) | local: `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key | browser-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key | server-only; used by image upload |

### Payments — ⚠ REQUIRED FOR LAUNCH (mock works today, Razorpay needed for real money)
| Key | Value | Notes |
|-----|-------|-------|
| `PAYMENT_GATEWAY` | `mock` in dev/e2e → `razorpay` at launch | mock = full lifecycle without keys via `/mock-pay`; guarded off on Vercel prod unless `ALLOW_MOCK_PAYMENTS=true` |
| `RAZORPAY_KEY_ID` | `rzp_test_…` now → `rzp_live_…` at launch | Dashboard → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | matching secret | server-only |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | same as `RAZORPAY_KEY_ID` | browser SDK needs it |
| `RAZORPAY_WEBHOOK_SECRET` | your chosen webhook secret | must match dashboard webhook config |
| `NEXT_PUBLIC_CHECKOUT_ENABLED` | `true` at launch | **off by default** — storefront runs WhatsApp-enquiry mode (no cart/checkout); admin records offline sales at /admin/orders/new |

### Shipping
| Key | Value | Notes |
|-----|-------|-------|
| `SHIPPING_PROVIDER` | `manual` \| `shiprocket` \| `dtdc` | default `manual` (admin types courier/AWB) |
| `SHIPPING_MOCK` | `true` in dev/e2e | shiprocket/dtdc return deterministic fixtures without keys |
| `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` / `SHIPROCKET_PICKUP_LOCATION` | Shiprocket API user | needed when `SHIPPING_PROVIDER=shiprocket` and not mocked |
| `DTDC_API_KEY` / `DTDC_CUSTOMER_CODE` / `DTDC_SERVICE_TYPE` | DTDC integration creds | needed when `SHIPPING_PROVIDER=dtdc` and not mocked |

### Analytics & error tracking — optional
| Key | Value | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_GA_ID` | GA4 measurement id (`G-…`) | unset = gtag mirror skipped; first-party `AnalyticsEvent` always runs. Clear if GA4 is only via GTM |
| `NEXT_PUBLIC_GTM_ID` | GTM container id (`GTM-…`) | unset = no Tag Manager snippet; set in GitHub Actions **Variables** (same as GA) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry project DSN (server/client) | unset = Sentry no-ops |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Sentry source-map upload | only needed in CI/prod build for readable stack traces |

### Email (Resend)
| Key | Value | Notes |
|-----|-------|-------|
| `RESEND_API_KEY` | Resend API key | order-confirmation emails; absent = emails silently skipped |
| `EMAIL_FROM` | `VAIRIS <orders@thevairis.com>` | must be a Resend-verified domain sender |

### Auth / app
| Key | Value | Notes |
|-----|-------|-------|
| `ADMIN_EMAILS` | comma-separated admin emails | gates /admin and admin APIs |
| `NEXT_PUBLIC_APP_URL` | `https://<domain>` | used in OAuth redirects, password-reset links, email links — must match real domain |
| `NEXT_PUBLIC_SITE_THEME` | *(optional)* `light` / `dark` | default storefront theme |

### Gold rate cron
| Key | Value | Notes |
|-----|-------|-------|
| `GOLD_SYNC_SECRET` | random secret | Bearer token for `/api/admin/sync-gold-rate` |
| `METAL_PRICE_API_KEY` | metals-api key | live gold price source |

### Order lifecycle
| Key | Value | Notes |
|-----|-------|-------|
| `ORDER_SWEEP_SECRET` | random secret | Bearer token for `/api/admin/sweep-orders` (expiry sweep) |
| `ORDER_EXPIRY_HOURS` | *(optional)* number, default `24` | age (hours) after which an unpaid `PAYMENT_PENDING` order is swept to `PAYMENT_EXPIRED` |
| `RETURN_WINDOW_DAYS` | *(optional)* number, default `7` | days after delivery a customer can self-serve a return request |

---

## 2. Third-party configuration (outside the repo)

1. **Razorpay** (owner: Nishi)
   - [ ] Generate TEST keys → `.env.local` → run a full test payment (card `4111 1111 1111 1111`)
   - [ ] KYC + activation for LIVE mode (needs business docs; BIS cert dependency — Anil)
   - [ ] Register webhook: URL `https://<domain>/api/webhooks/payment`, secret = `RAZORPAY_WEBHOOK_SECRET`, events: `payment.captured`, `payment.failed`, `refund.processed`
   - [ ] Enable payment methods in dashboard (UPI, cards, netbanking) + set settlement account
2. **Delivery partner** (owner: Anil/Nishi) — Shiprocket and DTDC adapters are both built (`lib/shipping/shiprocket.ts`, `lib/shipping/dtdc.ts`)
   - [ ] Get API credentials for the chosen partner, set env (`SHIPROCKET_*` or `DTDC_*`), set `SHIPPING_PROVIDER`
   - [ ] Unset `SHIPPING_MOCK` once real credentials are in place
   - [ ] Until then: `SHIPPING_PROVIDER=manual` (admin types courier/AWB) — launch is NOT blocked on this
3. **Resend**
   - [ ] Verify sending domain (SPF + DKIM records) → set `EMAIL_FROM`
   - [ ] **Auth emails (Supabase Cloud dashboard → Authentication → Email Templates)** — branded
     templates exist locally at `supabase/templates/*.html` (confirmation, recovery, magic_link,
     email_change, invite, reauthentication) and are wired in `supabase/config.toml`. These apply
     automatically to a *linked* local project via `supabase config push`, but a fresh Supabase
     Cloud project needs the same HTML pasted into each template in the dashboard, OR set up
     Custom SMTP (Dashboard → Auth → SMTP Settings) with Resend credentials so auth emails send
     from the same verified domain as order emails. **Do this before launch** — the raw default
     Supabase template ("Admin <admin@email.com>", no branding) reads as a phishing email.
4. **Google OAuth** (Supabase → Auth → Providers)
   - [ ] Add production redirect URL `https://<domain>/api/auth/callback`
5. **Custom domain** (roadmap P1)
   - [ ] Buy/point domain → Vercel; update `NEXT_PUBLIC_APP_URL` everywhere
6. **Gold-rate cron** (roadmap P2 — GitHub Actions, NOT Vercel cron)
   - [ ] Scheduled workflow POSTing to `/api/admin/sync-gold-rate` with `Authorization: Bearer $GOLD_SYNC_SECRET` every ~1h market hours
7. **Order expiry sweep** (GitHub Actions, NOT Vercel cron)
   - [ ] Scheduled workflow POSTing to `/api/admin/sweep-orders` with `Authorization: Bearer $ORDER_SWEEP_SECRET` hourly — expires stale unpaid orders past `ORDER_EXPIRY_HOURS`

## 3. Database — production migrations (⚠ not yet applied)

```bash
DATABASE_URL="<prod session pooler>" DIRECT_DATABASE_URL="<prod direct>" npx prisma migrate deploy
```
Applies, in order: `add_necklaces_category`, `order_flow_deposit_banners` (enum additions are one-way — back up first: Supabase → Database → Backups).

## 4. Code / content work remaining

| Item | Size | Blocking launch? |
|------|------|------------------|
| Replace 51 generated placeholder images (avatars, video thumbs, PLP heroes, contact/returns art — `scripts/_gen-placeholders.mjs` list) with real photos | content | Soft — placeholders are branded, but real photos = top-tier |
| ContactUsFab form has no backend (fake success) — wire to Resend email or a `ContactRequest` table | S | Yes — a dead contact form on a live store erodes trust |
| Legal pages: Privacy Policy, Terms, Refund/Deposit policy (footer links exist; content needed). Razorpay LIVE activation requires refund policy URL | content | Yes |
| SEO (roadmap P7): `sitemap.xml`, `robots.txt`, per-page metadata audit, JSON-LD Product schema on PDPs | M | Soft |
| Home page claims ("Loved by 10,000+ women", "4.9 (2,300+ reviews)") — replace with true numbers or remove | XS | Yes — fake social proof is a legal/trust risk |
| Email template redesign (roadmap P8) — current one is functional-minimal | S | No |
| Admin dashboard order stats (orders today, pending refunds) | S | No |
| Rate limiting on public APIs (`/api/track-order`, auth) — Vercel WAF rules or middleware | S | Soft |
| Sentry (or similar) error tracking | S | Soft |

## 5. Pre-launch QA gate

Run all of these green on the production build:
```bash
npm run lint && npx tsc --noEmit && npm run build
node scripts/_flow-test.mjs            # 14-step storefront regression
node scripts/_order-lifecycle-test.mjs # 70-scenario order lifecycle v2 (checkout, admin transitions,
                                        # refund ledger, sweep, returns, notes, auto-split)
node scripts/_crawl.mjs                # route/console/404 crawl
```
Manual: one REAL test-mode payment end-to-end (checkout → Razorpay modal → confirmation → admin ship → deliver → deposit refund from admin → verify refund lands in Razorpay dashboard + status flips via webhook).

## 6. Launch-day sequence

1. Apply prod DB migrations (§3)
2. Set all env vars in Vercel (§1) — live Razorpay keys
3. Register live webhook (§2.1)
4. Merge `order-flow` → `master` (auto-deploys)
5. Smoke test on prod: browse, login, cart, ₹1-product test order end-to-end, refund it
6. Turn on gold-rate cron
7. Watch Vercel logs + Razorpay dashboard for the first orders

---
*Companion docs: [FEATURES.md](./FEATURES.md) — feature inventory · [API.md](./API.md) — API reference.*
