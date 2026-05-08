# VAIRIS — Fine Jewellery E-Commerce

Internal review build. Catalogue, admin dashboard, customer auth, wishlist, and live gold-rate pricing.

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
On success it prints credentials. Copy the output — you'll need the keys.

### 3. Create `.env.local`

```bash
cp .env.local.example .env.local
```

Fill in the values from `supabase start` output:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAILS=anil@thevairis.com,nish99.sn@gmail.com
CRON_SECRET=any-random-string
INTERNAL_API_KEY=any-random-string
```

### 4. Push database schema

```bash
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
DIRECT_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
npx prisma db push
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

```bash
npm test                    # run all unit tests
npm test -- --watch         # watch mode
```

**Coverage:** Auth (11), Cart (14), Admin products (18), Wishlist (12), Stock (12), Public products (5) = **72 tests**

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

**Suites:**

| File | Tests | Covers |
|------|-------|--------|
| `store.spec.ts` | 7 | Homepage, shop, category pages, 404 |
| `auth.spec.ts` | 8 | Customer + admin login, redirects |
| `wishlist.spec.ts` | 9 | Wishlist add/remove, unauthed flow |
| `admin-product.spec.ts` | 8 | Create → visible on store → edit → cleanup |
| `customer-auth.spec.ts` | 14 | Sign-up tabs, forgot password, reset |

---

## Production Deployment (Vercel)

See deployment checklist in `docs/superpowers/plans/`.

**Quick summary:**
1. Create Supabase cloud project (free tier, Mumbai region)
2. Run `npx prisma db push` against cloud DB
3. Run `node scripts/upload-catalogue.mjs` with cloud credentials
4. Push repo to GitHub
5. Import in Vercel, set env vars (see `.env.local.example`)
6. Add Vercel URL to Supabase → Auth → URL Configuration

**Required env vars for Vercel:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...pooler...:6543/postgres   # Transaction pooler
DIRECT_DATABASE_URL=postgresql://...pooler...:5432/postgres  # Session pooler
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
ADMIN_EMAILS=anil@thevairis.com,nish99.sn@gmail.com
CRON_SECRET=<32-char random string>
INTERNAL_API_KEY=<32-char random string>
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 5 |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Storage | Supabase Storage |
| Styling | Tailwind CSS |
| Font | Cormorant Garamond + Inter |
| Testing | Jest (unit) + Playwright (E2E) |
| Deployment | Vercel (preview) → Azure (production) |

---

## Project Structure

```
app/
  (store)/          # Customer-facing pages (/, /shop, /wishlist, /account)
  (admin)/          # Admin pages (/admin/dashboard, /admin/products)
  auth/             # Auth pages (login, admin login, password reset)
  api/              # API routes
components/
  store/            # Customer UI components
  admin/            # Admin UI components
  auth/             # Auth UI components
lib/                # Shared utilities (prisma, supabase, auth, pricing)
prisma/             # Schema, migrations, seed
scripts/            # Bulk upload, Notion sync
public/images/      # Brand assets (logos, hero images, category photos)
e2e/                # Playwright E2E tests
__tests__/          # Jest unit tests
docs/               # Design specs and implementation plans
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

**`prisma db push` fails with connection error**
→ Ensure `supabase start` completed successfully. Check with `supabase status`.
