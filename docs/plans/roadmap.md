# Vairis — Remaining Work Roadmap

> Quick reference for all pending tasks. Ordered by priority.

---

## 1. Google Auth (config only — code already done)

**Time:** ~30 min

**Step 1 — Google Cloud Console**
1. [console.cloud.google.com](https://console.cloud.google.com) → New Project "Vairis"
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID → Web application
3. Authorised redirect URIs → add:
   ```
   https://ohnydotpayefvaurtiyy.supabase.co/auth/v1/callback
   ```
4. Copy **Client ID** and **Client Secret**

**Step 2 — Supabase**
1. Supabase → Auth → Providers → Google → Enable
2. Paste Client ID + Client Secret → Save

**Step 3 — Verify**
- `https://vairis-ten.vercel.app/auth/login` → "Continue with Google" → should work

No code changes needed. `GoogleButton` component and callback page already built.

---

## 2. Custom Domain

**Time:** ~20 min (+ up to 30 min DNS propagation)

**Step 1 — Remove from other Vercel project**
- Other Vercel project → Settings → Domains → remove the domain

**Step 2 — Add to Vairis Vercel project**
- Vairis Vercel → Settings → Domains → add domain
- Vercel gives you two DNS records to add

**Step 3 — GoDaddy DNS**

Add these records (Vercel shows exact values):

| Type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

`@` = root domain. Save and wait 10-30 min.

**Step 4 — Update Vercel env var**
- `NEXT_PUBLIC_APP_URL` → `https://yourdomain.com`

**Step 5 — Supabase Auth URLs**
- Auth → URL Configuration → Site URL → `https://yourdomain.com`
- Redirect URLs → add `https://yourdomain.com/**`
- Keep `https://vairis-ten.vercel.app/**` until domain confirmed working

**Step 6 — Redeploy** on Vercel to pick up new env var.

---

## 3. Live Gold Rate — GitHub Actions

**Time:** ~1-2 hrs

**Step 1 — API**
Sign up at [metalpriceapi.com](https://metalpriceapi.com) — free tier, 100 req/month.
Get API key.

**Step 2 — Script** `scripts/sync-gold-rate.mjs`
```js
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const KEY = process.env.METAL_PRICE_API_KEY

const res = await fetch(
  `https://api.metalpriceapi.com/v1/latest?api_key=${KEY}&base=XAU&currencies=INR`
)
const { rates } = await res.json()

// 1 troy oz = 31.1035g. XAU is pure gold (24K).
const per24kGram = rates.INR / 31.1035

await prisma.goldRate.upsert({
  where: { metalType: 'GOLD_22K' },
  update: { ratePerGram: per24kGram * (22 / 24) },
  create: { metalType: 'GOLD_22K', ratePerGram: per24kGram * (22 / 24) },
})
await prisma.goldRate.upsert({
  where: { metalType: 'GOLD_18K' },
  update: { ratePerGram: per24kGram * (18 / 24) },
  create: { metalType: 'GOLD_18K', ratePerGram: per24kGram * (18 / 24) },
})

console.log(`Gold rates updated — 24K: ₹${per24kGram.toFixed(2)}/g`)
await prisma.$disconnect()
```

**Step 3 — GitHub Actions** `.github/workflows/gold-rate.yml`
```yaml
name: Sync Gold Rate

on:
  schedule:
    - cron: '0 2 * * *'   # 7:30 AM IST daily (UTC+5:30)
  workflow_dispatch:        # manual trigger from GitHub UI

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx prisma generate
      - run: node scripts/sync-gold-rate.mjs
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
          METAL_PRICE_API_KEY: ${{ secrets.METAL_PRICE_API_KEY }}
```

**Step 4 — GitHub Secrets**
Repo → Settings → Secrets → Actions → add:
- `PROD_DATABASE_URL` — Transaction Pooler URL (port 6543 + `?pgbouncer=true`)
- `METAL_PRICE_API_KEY` — from metalpriceapi.com

**Step 5 — Test**
Actions tab → `Sync Gold Rate` → Run workflow manually → verify `GoldRate` table in Supabase updates.

---

## 4. Razorpay Integration

**Time:** 2-3 days (dev account fast, prod needs BIS cert)

### Prerequisites
- Dev: Razorpay test account (sign up at razorpay.com) — immediate
- Prod: BIS certificate + bank account linked (Anil handling)

### What needs building

**A — Checkout flow (store)**
1. Cart page (`/cart`) — show CartItems, total, proceed to checkout button
2. Checkout page (`/checkout`) — address form + Razorpay payment button
3. Order confirmation page (`/orders/[id]`)

**B — Payment API routes**
1. `POST /api/orders` — create Order + Razorpay order, return `razorpay_order_id`
2. `POST /api/orders/verify` — webhook handler, verify signature, update Payment status to CAPTURED
3. `POST /api/orders/[id]/cancel` — cancel order + initiate refund via Razorpay Refund API

**C — Admin**
1. Orders list page (`/admin/orders`) — view all orders, status, payment status
2. Direct payment links (`/admin/payment-links`) — generate Razorpay Payment Links for custom orders

### Key env vars to add
```
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxx   # exposed to browser for checkout
```

### Flow
```
User → /cart → /checkout (address + variant) →
POST /api/orders → Razorpay order created →
Razorpay checkout modal (browser) →
User pays → Razorpay webhook hits /api/orders/verify →
Order status → PAYMENT_CONFIRMED → redirect /orders/[id]
```

### EMI note
Razorpay EMI works automatically for cards above ₹3,000 — no extra code. Just enable in Razorpay dashboard.

---

## 5. Shiprocket Integration

**Time:** 1 day (after Razorpay is done)

### Prerequisites
- Razorpay checkout working (orders being created in DB)
- Shiprocket account — sign up at [shiprocket.in](https://shiprocket.in) (free to start)
- For international: FedEx account (separate, later)

### What needs building

**A — Shiprocket lib** `lib/shiprocket.ts`
```ts
// Handles: auth token, create shipment, track shipment
const BASE = 'https://apiv2.shiprocket.in/v1/external'

async function getToken() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    }),
  })
  const { token } = await res.json()
  return token
}

export async function createShipment(order: Order) { ... }
export async function trackShipment(awbCode: string) { ... }
export async function cancelShipment(shiprocketId: string) { ... }
```

**B — API routes**
- `POST /api/orders/[id]/ship` — admin triggers shipping after payment confirmed, creates Shiprocket order, stores `awbCode` + `shiprocketId` in `Shipment` table
- `POST /api/shiprocket/webhook` — Shiprocket status updates (picked → in transit → delivered), updates `Shipment.status`

**C — Admin UI**
- Orders list shows shipment status
- "Create Shipment" button per order (appears after PAYMENT_CONFIRMED)
- Tracking URL shown per order

### Flow
```
Order PAYMENT_CONFIRMED
  → Admin clicks "Create Shipment"
  → POST /api/orders/[id]/ship
  → Shiprocket order created → AWB code assigned → courier picked
  → Shiprocket webhook fires on status changes
  → POST /api/shiprocket/webhook → updates Shipment.status
  → Customer sees tracking URL in /orders/[id]
```

### Key env vars
```
SHIPROCKET_EMAIL=your@email.com
SHIPROCKET_PASSWORD=yourpassword
```

Note: Shiprocket uses email/password auth (not API key). Token expires every 24hrs — fetch fresh token per request or cache with 23hr TTL.

### Shipment model (already in schema)
```prisma
model Shipment {
  shiprocketId  String?   // Shiprocket order ID
  awbCode       String?   // tracking number
  courierName   String?   // e.g. "Delhivery"
  trackingUrl   String?
  status        String?   // picked_up, in_transit, delivered, etc.
}
```

### International (FedEx — later)
- Same pattern but different API
- FedEx requires separate account + API credentials
- Add `carrier` field to Shipment to distinguish domestic vs international

---

## 6. Azure Migration

**Time:** 1-2 days setup, then gradual

### Why Azure over staying on Vercel
- Startup credits (~$5K) = free hosting for months
- No Hobby plan limits (crons, image optimization, function timeouts)
- Full control over infrastructure

### Approach — Azure Static Web Apps + Azure Functions

Next.js on Azure has two options:

**Option A — Azure Static Web Apps (recommended)**
- Purpose-built for Next.js / React
- Free tier generous
- Auto-deploys from GitHub (like Vercel)
- Supports SSR, ISR, API routes via built-in Azure Functions
- `npx @azure/static-web-apps-cli` handles the config

**Option B — Azure App Service (Docker)**
- More control, more setup
- Containerise the Next.js app with Docker
- Better for complex setups, overkill now

### Migration steps (Option A)

**Step 1 — Azure account**
- Already signed up for startup program
- Get credits activated at [portal.startups.microsoft.com](https://portal.startups.microsoft.com)

**Step 2 — Create Static Web App**
- Azure Portal → Static Web Apps → Create
- Connect to GitHub repo → branch: master
- Framework: Next.js → auto-detects build command

**Step 3 — Environment variables**
- Azure → Static Web App → Configuration → Application settings
- Add all env vars from Vercel (DATABASE_URL, SUPABASE keys, etc.)

**Step 4 — Update `staticwebapp.config.json`** (Azure's equivalent of `vercel.json`)
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/_next/*"]
  },
  "platform": {
    "apiRuntime": "node:20"
  }
}
```

**Step 5 — Crons on Azure**
- Azure Logic Apps or Azure Functions Timer Trigger
- Replace GitHub Actions gold rate sync with Azure Logic App
- Runs reliably, no GitHub dependency

**Step 6 — Domain**
- Azure → Static Web App → Custom domains → add `thevairis.com`
- Update GoDaddy DNS to point to Azure instead of Vercel
- Update Supabase redirect URLs

**Step 7 — Cutover**
- Confirm Azure deployment working end-to-end
- Switch DNS → 5-30 min propagation → live on Azure
- Decommission Vercel project

### Key difference from Vercel
Vercel reads `next.config.mjs` natively. Azure Static Web Apps uses a hybrid rendering adapter. If anything breaks, `@azure/static-web-apps-cli` has a `swa` command to test locally before deploying.

---

## Status Overview

| Task | Status |
|---|---|
| Google Auth (config) | ⏳ Pending |
| Custom Domain | ⏳ Pending |
| Live Gold Rate | ⏳ Pending |
| Razorpay dev account | ⏳ Pending |
| Razorpay integration | ⏳ Pending (needs BIS cert for prod) |
| Shiprocket | ⏳ Pending (after Razorpay — plan in §5) |
| Checkout flow | ⏳ Pending (after Razorpay) |
| Azure migration | ⏳ Background (Vercel sufficient now) |
| SEO sitemap/robots | ⏳ Low priority |
| Email template redesign | ⏳ Low priority |
| Silver 925 removal | ⏳ Quick fix, ~30min |
| Gold color/purity split | ⏳ Future (post-Razorpay) |
