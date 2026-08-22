# VAIRIS — Fine Jewellery E-Commerce

Next.js 16 (App Router) + Supabase (Postgres + Auth + Storage) + Prisma 5.
Catalogue, checkout, admin dashboard, order lifecycle, delivery integration,
live gold-rate pricing. Deployed to Vercel (preview) and Azure Container
Apps (staging/prod) — see `CLAUDE.md` for the full project context.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20.9+ | `nvm install 20.9.0` |
| Docker Desktop | Latest | [docker.com](https://www.docker.com/products/docker-desktop/) — must be running |
| Supabase CLI | 2.90+ | `brew install supabase/tap/supabase` |

> **macOS only:** image compression uses `sips` (built-in). No extra install needed.

---

## First-Time Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/YOUR_ORG/vairis.git
cd vairis
nvm use 20.9.0        # or: export PATH="$HOME/.nvm/versions/node/v20.9.0/bin:$PATH"
npm install
```

### 2. Start local Supabase (requires Docker running)

```bash
supabase start
```

First run downloads ~500 MB of Docker images — takes 2–3 minutes.
On success it prints credentials. Copy the output — you'll need the keys
for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` below.

### 3. Create `.env.local`

```bash
cp .env.local.example .env.local
```

`.env.local.example` is the source of truth for every env var this app
reads — payments, shipping, email, analytics, error tracking. Most of it
has safe defaults for local dev (mocked payment gateway, mocked shipping)
so you don't need real Razorpay/Sequel247/Resend credentials to run the
app. Fill in only what's below to get started; leave the rest blank.

```env
# From `supabase start` output:
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# Prisma — same local Postgres, both point at port 54322
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAILS=you@example.com          # whitelist for /admin/* — use the email you'll sign up with

# Already keyless by default in .env.local.example — leave as-is for local dev:
# PAYMENT_GATEWAY=mock
# SHIPPING_PROVIDER=sequel247
# SHIPPING_MOCK=true
```

Everything else in `.env.local.example` (Razorpay, Shiprocket, DTDC,
Sequel247, Resend, gold-rate API, Sentry, GA4) is optional locally — the
mock payment gateway and `SHIPPING_MOCK=true` give you a full working
checkout → order → shipment lifecycle without any of those keys.

### 4. Apply the database schema

```bash
npx prisma migrate deploy
```

This replays every migration in `prisma/migrations/` against your fresh
local DB. (Not `prisma db push` — that's for schema prototyping without
migration history; this project has real migrations and `migrate deploy`
is what CI/production actually run.)

Optional: seed sample data —

```bash
npm run seed
```

### 5. Create your admin account

Start the dev server (`npm run dev`), then go to:

```
http://localhost:3000/auth/admin
```

Click "No account?" → create an account with the email in `ADMIN_EMAILS`.

---

## Running the App

```bash
npm run dev
```

| URL | What |
|-----|------|
| `http://localhost:3000` | Customer storefront |
| `http://localhost:3000/auth/login` | Customer sign-in / sign-up |
| `http://localhost:3000/auth/admin` | Admin sign-in (whitelist only) |
| `http://localhost:3000/admin/dashboard` | Admin dashboard |
| `http://localhost:3000/admin/products/new` | Add a product |
| `http://localhost:3000/shop` | Product catalogue |
| `http://localhost:3000/checkout` | Checkout (mock payment gateway by default) |
| `http://localhost:3000/wishlist` | Customer wishlist |
| `http://127.0.0.1:54323` | Supabase Studio (local DB browser) |
| `http://127.0.0.1:54324` | Mailpit (catches all auth emails locally) |

---

## Bulk Catalogue Upload

To upload all products from the `VairisCatalogueDriveShare` folder:

```bash
node scripts/upload-catalogue.mjs
```

**Requirements:**
- `supabase start` must be running
- `CATALOGUE_DIR` in the script must point to your local catalogue folder
- PNGs are compressed to JPEG 82% automatically via `sips`

Script is idempotent — skips products already in DB by `itemCode`.

---

## Unit Tests

No `npm test` script — run Jest directly:

```bash
npx jest                              # run all unit tests
npx jest --watch                      # watch mode
npx jest __tests__/lib/shipping/      # a specific directory
```

If you're inside `.worktrees/` (see `docs/superpowers/` workflow docs), a
stale worktree copy of `__tests__/` can get picked up too and double-count
results — add `--testPathIgnorePatterns='/.worktrees/'` if that happens.

---

## E2E Tests (Playwright)

Requires the dev server running on port 3000 and Supabase running.

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run e2e                 # run all E2E tests (headless)
npm run e2e:ui              # open Playwright UI (interactive)
npx playwright test e2e/store.spec.ts         # specific suite
npx playwright test e2e/auth.spec.ts          # auth flows
npx playwright test e2e/wishlist.spec.ts      # wishlist flows
npx playwright test e2e/admin-product.spec.ts # admin CRUD
npx playwright test e2e/customer-auth.spec.ts # sign-up, forgot password
```

**E2E test account:** `nish99.sn@gmail.com` / `Admin1234!` (local Supabase)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL via Supabase (local); Azure Postgres Flexible Server (staging/prod) |
| ORM | Prisma 5 |
| Auth | Supabase Auth locally (email/password + Google OAuth); self-hosted GoTrue on Azure staging/prod |
| Storage | Supabase Storage (local) / Azure Blob (staging/prod — `STORAGE_PROVIDER=azure`) |
| Styling | Plain CSS (`app/globals.css`) + inline style objects — no CSS framework |
| Payments | Razorpay, behind a `PAYMENT_GATEWAY=mock` keyless dev mode (`lib/payments/`) |
| Shipping | Sequel247 (chosen partner), Shiprocket/DTDC adapters also exist, behind `SHIPPING_MOCK=true` keyless dev mode (`lib/shipping/`) |
| Testing | Jest (unit) + Playwright (E2E) |
| Deployment | Vercel (preview) → Azure Container Apps (staging/prod) |

---

## Project Structure

```
app/
  (store)/          # Customer-facing pages (/, /shop, /wishlist, /account)
  (admin)/          # Admin pages (/admin/dashboard, /admin/products, /admin/orders)
  auth/             # Auth pages (login, admin login, password reset)
  api/              # API routes
components/
  store/            # Customer UI components
  admin/            # Admin UI components
  auth/             # Auth UI components
lib/                # Shared utilities (prisma, supabase, auth, pricing, payments/, shipping/)
prisma/             # Schema, migrations, seed
scripts/            # Bulk upload, Notion sync
public/images/      # Brand assets (logos, hero images, category photos)
e2e/                # Playwright E2E tests
__tests__/          # Jest unit tests
docs/               # Design specs and implementation plans (docs/superpowers/)
infra/              # Bicep IaC for Azure (staging/prod)
```

---

## Common Issues

**`supabase start` fails**
→ Docker Desktop must be running first.

**`npm run dev` — port 3000 in use**
→ `PORT=3001 npm run dev`

**Admin login doesn't work**
→ Check `ADMIN_EMAILS` in `.env.local` matches the email you signed up with.

**Images not loading (404)**
→ Run `supabase start` — the storage service must be running.

**`prisma migrate deploy` fails with connection error**
→ Ensure `supabase start` completed successfully. Check with `supabase status`.

**Local Apple Silicon Docker builds fail with `NODE_OPTIONS`/`ERR_WORKER_INVALID_EXEC_ARGV`**
→ Only relevant if you're building the production Docker image locally
(`docker build` / `azd deploy`) — Rosetta injects `NODE_OPTIONS=--no-opt`
into amd64-emulated containers, which Turbopack's worker threads reject.
Already worked around in the `Dockerfile`; not an issue for `npm run dev`.

---

## Production Deployment

Staging/prod run on Azure Container Apps via `azd` + GitHub Actions
(`.github/workflows/azure-dev.yml`, push to `stage_preprod`/`master`). See
`infra/` for the Bicep modules and `CLAUDE.md` §3 for hard infra
constraints (Session Pooler only, no Vercel crons, etc). Vercel preview
deploys are also available but not the production path.
