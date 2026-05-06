# Vairis — Gold Price Integration Design

**Date:** 2026-04-26
**Sub-project:** Website add-on (integrates into 2026-04-23-vairis-ecommerce plan)
**Author:** Satya Nishanth (Nishi)
**Status:** Approved, ready for implementation plan

---

## 1. Scope

Add dynamic gold-rate-based pricing to the Vairis e-commerce website. Product prices are not static; they are calculated at render time from the current gold rate fetched from a public API (GoldAPI.io) and cached in the database.

**In scope:**
- Gold rate fetching from GoldAPI.io (24K + Silver, derived to 22K/18K)
- `GoldRate` table caching rates (upserted by a Vercel cron)
- `ProductVariant` schema changes — replace static `price` with weight + charge fields
- `lib/pricing.ts` — pure price calculation function
- `lib/goldprice.ts` — GoldAPI.io fetch + DB upsert
- New cron route `/api/cron/refresh-gold-rate`
- Store product pages showing live price breakdown
- Admin panel: current gold rate display + product form with pricing fields

**Out of scope:**
- Admin manual rate override (can be added later)
- Historical gold rate tracking / charts
- Gold rate push notifications to customers

---

## 2. Architecture

```
Vercel Cron (*/30 * * * *)
  └── /api/cron/refresh-gold-rate
        └── lib/goldprice.ts
              ├── GoldAPI.io (XAU/INR, XAG/INR)
              └── Prisma upsert → GoldRate table

Product page render (ISR 60s)
  ├── Prisma: fetch ProductVariant
  ├── Prisma: fetch GoldRate (by metalType)
  └── lib/pricing.ts: calculatePrice(variant, goldRate)
        → price breakdown object

Checkout API (/api/checkout)
  ├── Prisma: fetch current GoldRate
  ├── lib/pricing.ts: calculatePrice(variant, goldRate)
  └── Snapshot price locked in OrderItem.price + Order.totalAmount
```

---

## 3. Data Model Changes

### 3.1 ProductVariant — replace `price: Decimal` with weight + charge fields

```prisma
model ProductVariant {
  id                  String      @id @default(cuid())
  productId           String
  product             Product     @relation(fields: [productId], references: [id])
  metalType           MetalType
  size                String?
  weightGrams         Decimal     // net gold weight in grams
  makingChargePerGram Decimal     // INR per gram (scales with weight)
  flatMakingCharge    Decimal     @default(0)  // flat labor for complex designs
  stoneCharges        Decimal     @default(0)  // diamonds / gemstones (fixed)
  miscCharges         Decimal     @default(0)  // hallmark ₹45, certs, packaging, wastage
  stock               Int         @default(0)
  sku                 String      @unique
  cartItems           CartItem[]
  orderItems          OrderItem[]
}
```

`price: Decimal` is removed. Prices are always calculated at runtime.

### 3.2 GoldRate — new model (one row per MetalType, upserted by cron)

```prisma
model GoldRate {
  metalType   MetalType  // GOLD_18K | GOLD_22K | SILVER_925 | ROSE_GOLD
  ratePerGram Decimal    // INR per gram at this purity
  fetchedAt   DateTime   @updatedAt
  @@id([metalType])
}
```

### 3.3 OrderItem — `price` snapshot unchanged

`OrderItem.price: Decimal` stays. Price is locked at order creation time from the then-current gold rate. Post-order gold rate changes have no effect.

---

## 4. Price Calculation

### Formula

```
goldValue     = weightGrams × goldRate.ratePerGram
making        = (weightGrams × makingChargePerGram) + flatMakingCharge
gst           = (goldValue × 0.03) + (making × 0.05)
totalPrice    = goldValue + making + stoneCharges + miscCharges + gst
```

GST breakdown per India tax rules:
- 3% GST on gold value
- 5% GST on making charges
- Stone charges and misc charges: no GST applied at item level (charged separately per invoice rules)

### `lib/pricing.ts`

```typescript
export interface PriceBreakdown {
  goldValue: number
  making: number
  stoneCharges: number
  miscCharges: number
  gst: number
  total: number
}

export function calculatePrice(
  variant: {
    weightGrams: number
    makingChargePerGram: number
    flatMakingCharge: number
    stoneCharges: number
    miscCharges: number
  },
  goldRatePerGram: number
): PriceBreakdown {
  const goldValue = variant.weightGrams * goldRatePerGram
  const making = (variant.weightGrams * variant.makingChargePerGram) + variant.flatMakingCharge
  const gst = (goldValue * 0.03) + (making * 0.05)
  const total = goldValue + making + variant.stoneCharges + variant.miscCharges + gst
  return {
    goldValue,
    making,
    stoneCharges: variant.stoneCharges,
    miscCharges: variant.miscCharges,
    gst,
    total,
  }
}
```

---

## 5. Gold Rate Source

### API: GoldAPI.io

- Endpoint: `GET https://www.goldapi.io/api/XAU/INR` (gold)
- Endpoint: `GET https://www.goldapi.io/api/XAG/INR` (silver)
- Header: `x-access-token: <GOLD_API_KEY>`
- Returns: `{ price_gram_24k, price_gram_22k, price_gram_18k, ... }`
- Free tier: 100 requests/month (sufficient for 30-min cron = ~1,440/month → paid plan required)
- Alternative: metals-api.com

### `lib/goldprice.ts`

```typescript
export async function fetchAndCacheRates(): Promise<void> {
  const [goldRes, silverRes] = await Promise.all([
    fetch('https://www.goldapi.io/api/XAU/INR', {
      headers: { 'x-access-token': process.env.GOLD_API_KEY! }
    }),
    fetch('https://www.goldapi.io/api/XAG/INR', {
      headers: { 'x-access-token': process.env.GOLD_API_KEY! }
    })
  ])
  const gold = await goldRes.json()
  const silver = await silverRes.json()

  const upserts = [
    { metalType: 'GOLD_22K', ratePerGram: gold.price_gram_22k },
    { metalType: 'GOLD_18K', ratePerGram: gold.price_gram_18k },
    { metalType: 'ROSE_GOLD', ratePerGram: gold.price_gram_18k }, // rose gold = 18K alloy
    { metalType: 'SILVER_925', ratePerGram: silver.price_gram_24k * 0.925 },
  ]

  await Promise.all(upserts.map(u =>
    prisma.goldRate.upsert({
      where: { metalType: u.metalType },
      update: { ratePerGram: u.ratePerGram, fetchedAt: new Date() },
      create: { metalType: u.metalType, ratePerGram: u.ratePerGram },
    })
  ))
}
```

---

## 6. Cron Route

**File:** `app/api/cron/refresh-gold-rate/route.ts`

```typescript
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  await fetchAndCacheRates()
  return Response.json({ ok: true, refreshedAt: new Date().toISOString() })
}
```

**`vercel.json`** — add alongside existing `release-stock` cron:

```json
{ "path": "/api/cron/refresh-gold-rate", "schedule": "*/30 * * * *" }
```

Interval configurable by updating `schedule`. Default: every 30 minutes.

---

## 7. Store Page Changes

### Product Detail Page

- Fetch `GoldRate` for variant's `metalType` server-side
- Calculate `PriceBreakdown` via `lib/pricing.ts`
- Display transparent breakdown:

```
Gold Value (22K):   ₹12,450
Making Charges:     ₹1,200
Stone Charges:      ₹0
Misc Charges:       ₹45
GST (3% + 5%):      ₹433
────────────────────────────
Total:              ₹14,128

Gold rate: ₹6,225/gram  •  Last updated 12 min ago
```

### Product Listings (ProductCard)

Show calculated `total` price only. No breakdown at listing level.

### Cart

Prices recalculated at page load using current gold rate. Display note:
> "Prices reflect current gold rate and may vary before final checkout."

### Checkout API

```typescript
// In api/checkout/route.ts — at order creation:
const goldRate = await prisma.goldRate.findUnique({ where: { metalType: variant.metalType } })
if (!goldRate) throw new Error('Gold rate unavailable — cron may not have run yet')
const { total } = calculatePrice(
  {
    weightGrams: Number(variant.weightGrams),
    makingChargePerGram: Number(variant.makingChargePerGram),
    flatMakingCharge: Number(variant.flatMakingCharge),
    stoneCharges: Number(variant.stoneCharges),
    miscCharges: Number(variant.miscCharges),
  },
  Number(goldRate.ratePerGram)
)
// Store total as OrderItem.price snapshot
```

Note: All Prisma `Decimal` fields must be wrapped in `Number()` before passing to `calculatePrice`, which operates on JavaScript numbers.

---

## 8. Admin Panel Changes

### Dashboard widget

Show current `GoldRate` rows in dashboard:

```
Gold 22K:  ₹6,225/g   (updated 12 min ago)
Gold 18K:  ₹5,100/g   (updated 12 min ago)
Silver:    ₹78/g      (updated 12 min ago)
```

### Product Form

New fields on `ProductForm.tsx` (replaces old `price` field):
- Weight (grams): `weightGrams`
- Making charge per gram (₹): `makingChargePerGram`
- Flat making charge (₹): `flatMakingCharge`
- Stone charges (₹): `stoneCharges`
- Misc charges (₹): `miscCharges`

Live price preview calculated at current gold rate as admin fills form.

---

## 9. Environment Variables

```env
GOLD_API_KEY=                    # GoldAPI.io API key
```

(Added to `.env.local.example` and Vercel env config)

---

## 10. Migration Notes

Existing `ProductVariant.price` must be migrated:
- Add new columns with defaults (0)
- Admin fills in weight + charge data for existing products
- Remove old `price` column in follow-up migration after data entry

No automated migration of old price values — goldweight data must be entered manually.
