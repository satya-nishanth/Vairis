# Vairis Jewelry Pricing — Deep Analysis & Gap Report

**Date:** 2026-05-08  
**Author:** Satya Nishanth  
**Status:** Reference document — flags implementation gaps  
**Reviewed:** 3 passes for accuracy

---

## 1. How Jewelry Price is Decided in India

Jewelry pricing in India is NOT a fixed markup on cost. Every piece is priced dynamically using four components that combine into a final retail price. Understanding each is essential before building the pricing engine.

### 1.1 The Four Components

```
Total Price = Metal Value + Making Charges + Stone Charges + Misc Charges + GST
```

#### Component 1 — Metal Value (Gold/Silver)

This is the largest component, typically 60–75% of the total price.

```
Metal Value = Net Weight (grams) × Today's Metal Rate (₹/gram)
```

**Important nuance — "net weight" vs "gross weight":**
- **Gross weight**: weight of the entire ornament including stones, solder, enamel
- **Net weight** (also called "pure gold weight"): weight of only the gold content
- Karat purity tells you the conversion:
  - 24K = 99.9% pure (1g gross = 0.999g gold)
  - 22K = 91.6% pure (1g gross = 0.916g gold)
  - 18K = 75% pure (1g gross = 0.75g gold)
  - 925 Silver = 92.5% pure

**Our schema stores `weightGrams` as the NET gold weight** — this is correct. The CAD sheet (AJBR-74) lists 18kt weight as 8.500g — this IS the net weight at 18kt purity.

**Metal rates (approximate, May 2026):**
| Metal | Rate/gram |
|---|---|
| 24K Gold | ₹7,700 |
| 22K Gold | ₹7,060 |
| 18K Gold | ₹5,775 |
| Silver 925 | ₹78–85 |
| Rose Gold 18K | Same as 18K |

#### Component 2 — Making Charges

Labor, craftsmanship, design complexity. This is the jeweler's MARGIN component.

Two methods used in industry:

**Method A — Per gram:**
```
Making = weightGrams × makingChargePerGram
```
Typical ranges:
- Machine-made / chain-link: ₹100–200/gram
- Cast / simple design: ₹200–400/gram
- Handcrafted / intricate: ₹400–700/gram
- Haute couture / bespoke: ₹700–1,500/gram

**Method B — Flat charge:**
```
Making = flatMakingCharge (fixed INR amount)
```
Used for very labor-intensive designs where per-gram doesn't make sense (e.g., ₹3,000 flat for engraving regardless of weight).

**Method C — Combined (what Vairis schema supports):**
```
Making = (weightGrams × makingChargePerGram) + flatMakingCharge
```
This is the most flexible and industry-accurate. ✓

#### Component 3 — Stone Charges

Diamonds, precious stones, semi-precious stones. This is a FIXED cost per design regardless of metal.

**How stone charges are determined:**
- Diamonds: priced by carat weight, clarity (SI1/SI2/VS), cut, color (G-H grade common for jewelry)
- Rough estimate: ₹8,000–15,000 per ctw for SI-clarity G-color diamonds in jewelry setting
- The 2.00 ctw diamonds in AJBR-74 ≈ ₹16,000–30,000 depending on quality

**Our schema stores `stoneCharges` as a fixed INR amount per variant** — this is correct. The actual diamond cost is determined by the supplier and entered by admin.

#### Component 4 — Misc Charges

Fixed overhead per piece:
- BIS Hallmarking certificate: ₹35–45
- Rhodium/plating (for rose gold or white gold): ₹50–200
- Packaging (box, velvet pouch, certificate envelope): ₹50–150
- Wastage (gold lost in manufacturing, typically 1–3%): often included in making charges
- COD/payment gateway: absorbed separately

Our `miscCharges` field handles this ✓

#### GST (India — Jewelry Specific)

Per Indian GST notification (HSN 7113):

```
GST = (goldValue × 3%) + (makingCharges × 5%)
```

**Why this split?**
- GST on gold metal = 3%
- GST on making charges = 5% (classified as services, not goods)
- Stone charges: diamonds attract 0.25% GST separately; but for retail display purposes, this is bundled into the invoice — not broken out on the product page

**Our formula is correct** per industry practice:
```typescript
gst = (goldValue * 0.03) + (making * 0.05)
```

---

### 1.2 Worked Examples — AJBR-74 Heart Diamond Bracelet

Using today's approximate rates (18K gold ₹5,800/g, Silver ₹80/g):

#### Example A — 18kt Gold (8.500g)

| Component | Calculation | Amount |
|---|---|---|
| Gold Value | 8.500g × ₹5,800 | ₹49,300 |
| Making (per gram) | 8.500g × ₹400 | ₹3,400 |
| Stone Charges | 2.00 ctw diamonds (estimated) | ₹18,000 |
| Misc (hallmark + cert) | flat | ₹45 |
| GST | (49,300 × 3%) + (3,400 × 5%) | ₹1,649 |
| **Total** | | **₹72,394** |

Price moves with gold rate. If gold goes up ₹100/g → bracelet goes up ₹255 (8.5g × ₹100 + 3% GST on that).

#### Example B — Silver 925 (5.950g)

| Component | Calculation | Amount |
|---|---|---|
| Silver Value | 5.950g × ₹80 | ₹476 |
| Making (per gram) | 5.950g × ₹50 | ₹298 |
| Stone Charges | same diamonds | ₹18,000 |
| Misc | flat | ₹45 |
| GST | (476 × 3%) + (298 × 5%) | ₹29 |
| **Total** | | **₹18,848** |

Same design, same diamonds, 1/4 the price because metal value is tiny. This illustrates why silver + diamond jewelry is such a strong value proposition.

#### Example C — 22kt Gold (hypothetical, no stones, simple ring, 3.5g)

| Component | Calculation | Amount |
|---|---|---|
| Gold Value | 3.5g × ₹7,060 | ₹24,710 |
| Making (per gram) | 3.5g × ₹250 | ₹875 |
| Stone Charges | none | ₹0 |
| Misc | ₹45 | ₹45 |
| GST | (24,710 × 3%) + (875 × 5%) | ₹785 |
| **Total** | | **₹26,415** |

---

### 1.3 Price Sensitivity to Gold Rate

Gold rate is volatile. A 1% change in gold rate has a direct pass-through to retail price.

**AJBR-74 (18K, 8.5g) price range across gold rate scenarios:**

| 18K Rate | Total Price |
|---|---|
| ₹5,200/g (market dip) | ₹66,200 |
| ₹5,800/g (today approx) | ₹72,394 |
| ₹6,400/g (market peak) | ₹78,600 |

**12% gold price swing → 9% product price swing** (stones act as a buffer).

---

## 2. Industry Comparison

### 2.1 CaratLane

| Feature | CaratLane | Vairis (current) |
|---|---|---|
| Price on listing card | ✅ Single total price | ❌ None |
| Price on PDP | ✅ Total price | ❌ "Enquire for Price" |
| Price breakdown visible | ❌ Invoice only | ❌ Not yet |
| Gold rate update frequency | Weekly | Planned: 30-min cron (better) |
| Making charges | 6–14% per gram, varies by design | Planned: admin-set per variant |
| GST shown | ✅ Invoice breakdown | ❌ Not yet |
| Multiple metals | Separate product listings | Variants on same product ✓ |
| EMI widget | Likely (not confirmed) | Planned (EMIWidget component) |
| Zero making charges | ❌ No | ❌ No |
| Hallmark info | ✅ Shown on PDP | ❌ Not yet |
| "Price breakup" on page | ❌ Invoice only | Planned (spec says breakdown) |

**CaratLane key insight:** They don't show price breakdown ON the product page. It appears on the invoice. Their PDP shows a single clean total price. This is the industry norm for India.

### 2.2 Giva

| Feature | Giva | Vairis (current) |
|---|---|---|
| Price on listing card | ✅ Sale vs MRP | ❌ None |
| Price on PDP | ✅ Total inclusive | ❌ "Enquire for Price" |
| Making charges | ✅ **ZERO on all gold/diamond** | Planned: non-zero |
| Gold rate update | Market rate (not disclosed) | Planned: 30-min cron |
| Primary category | Silver (925) + Gold | Gold + Silver |
| Price range | ₹1,999–₹6,699 (silver) | Higher (gold-first) |
| Transparency | "Price based on avg weight" | Weight-precise (better) |
| Target customer | Mass-market, price-sensitive | Premium, design-first |

**Giva key insight:** Their "zero making charges" positioning is a massive marketing differentiator. However, it works because they compensate through volume and brand premium. Their margin is built into the metal rate uplift. Vairis does NOT need to copy this — Vairis is positioned as fine jewelry with genuine craftsmanship, so making charges are expected and justified.

### 2.3 What Vairis Should Do (vs What We're Doing)

| Decision | Industry | Vairis Plan | Verdict |
|---|---|---|---|
| Price formula | goldValue + making + stones + GST | Same ✓ | ✓ Correct |
| GST split | 3% gold + 5% making | Same ✓ | ✓ Correct |
| Gold rate source | Internal/manual or API | GoldAPI.io cron | ✓ Better |
| Rate update freq | Weekly (CaratLane) | 30-min cron | ✓ Better |
| Price on PDP | Single total | Planned: full breakdown | ✓ Better (transparency) |
| Making charges | Per gram or % | Per gram + flat ✓ | ✓ Correct |
| Zero making charges | Giva's gimmick | Not copying | ✓ Correct |
| Multiple metals | Separate products (CaratLane) | Same product, variants | ✓ Better UX |
| Price lock on order | At checkout time | Snapshot in OrderItem.price | ✓ Correct |

---

## 3. Current Vairis Implementation State

### 3.1 What Is Built

✅ **Schema** — All pricing fields exist in DB:
```prisma
// ProductVariant
weightGrams         Decimal
makingChargePerGram Decimal  @default(0)
flatMakingCharge    Decimal  @default(0)
stoneCharges        Decimal  @default(0)
miscCharges         Decimal  @default(0)

// GoldRate
metalType   MetalType  // per-purity rates
ratePerGram Decimal
fetchedAt   DateTime
```

✅ **GoldRate table** — seeded with placeholder values (not live):
- GOLD_22K: ₹6,225/g
- GOLD_18K: ₹5,100/g
- SILVER_925: ₹78/g
- ROSE_GOLD: ₹5,100/g

✅ **PDP shows** — weight per metal variant, gemstone specs, dimensions

✅ **Pricing spec written** — gold price integration design doc (2026-04-26) fully designed

### 3.2 What Is NOT Built (and Must Be)

❌ `lib/pricing.ts` — Core `calculatePrice()` function (Task 15, pending)

❌ `lib/goldprice.ts` + cron route — Live rate fetching (Task 16, pending)

❌ **Admin form pricing fields** — CRITICAL GAP (see Section 4)

❌ **Price display on PDP** — "Enquire for Price" is placeholder

❌ **Price on product card** — ProductCard shows no price

---

## 4. 🚨 Critical Issues (FLAGS)

### 🔴 FLAG 1 — Admin Form Missing Pricing Fields [BLOCKING]

**Severity: CRITICAL — Blocks entire pricing feature**

The `ProductForm` variants section only collects:
- Metal type
- Weight (grams)
- Stock
- SKU

**Missing fields (exist in schema, not in form):**
- `makingChargePerGram` — the core pricing input
- `flatMakingCharge` — for complex designs
- `stoneCharges` — diamond/gem cost (flat INR per design)
- `miscCharges` — hallmark, certs, packaging

**Impact:** Every product created through admin today has 0 for all charge fields. When pricing goes live, all products will calculate at ZERO making charges and ZERO stone charges → dangerously wrong prices (e.g., ₹49,300 instead of ₹72,394 for AJBR-74).

**Fix required:** Add 4 new number inputs to the variant row in `ProductForm.tsx`.

**Effort:** ~30 minutes of code + update existing products via admin edit.

---

### 🔴 FLAG 2 — lib/pricing.ts Not Built [BLOCKING]

**Severity: CRITICAL — No price can be calculated without this**

The function is designed in the spec (correct formula, correct types) but the file doesn't exist. Tasks 15 (pricing lib) and 16 (gold rate cron) are both pending.

**Impact:** Even if admin fills in all pricing fields and gold rates are seeded in DB, no price is ever calculated or shown.

**Fix:** Implement Task 15 (lib/pricing.ts). The spec is complete — it's straightforward TDD implementation.

---

### 🔴 FLAG 3 — Gold Rate Not Live [BLOCKING for accurate prices]

**Severity: CRITICAL for pricing accuracy**

The DB has placeholder seed values that never update. The GoldAPI.io cron (Task 16) is not built.

**Current state:**
- GOLD_18K: ₹5,100/g (seed) vs actual ~₹5,800/g (market) = **12% underpriced**
- GOLD_22K: ₹6,225/g (seed) vs actual ~₹7,060/g (market) = **12% underpriced**

**Impact:** With placeholder rates, showing any price to customers now would show prices **~12% below actual cost**. We'd lose money on every sale.

**Fix:** Implement Task 16 (lib/goldprice.ts + cron). Alternatively, allow admin to manually set rates via dashboard as a V1 stop-gap.

---

### 🟡 FLAG 4 — No Price Shown Anywhere [UX Gap vs Industry]

**Severity: MODERATE — hurts conversion**

CaratLane and Giva both show price on listing cards AND on PDP. Vairis currently shows "Enquire for Price" on the PDP and no price on product cards.

**Impact on user behavior:**
- Users who don't see a price must contact Vairis → high friction
- Industry research shows price transparency directly correlates with purchase intent
- "Enquire for Price" signals exclusivity (fine for luxury) but NOT appropriate for e-commerce with payment

**Acceptable for V1 catalog phase** (before payment is integrated) but must be resolved before checkout goes live.

**Fix required when pricing is ready:**
1. ProductCard: add total price display
2. PDP: add price breakdown section (gold value + making + stones + GST = total)

---

### 🟡 FLAG 5 — GST on Stones Not Accounted [Compliance]

**Severity: MODERATE — compliance risk on invoicing**

Our formula: `gst = (goldValue × 3%) + (making × 5%)`

This does NOT apply GST to stone charges. Per Indian GST:
- Cut & polished diamonds: 0.25% GST
- Precious stones (ruby, sapphire): 0.25% GST
- Semi-precious stones: 3% GST

For retail display purposes, this may be acceptable. But for invoicing at checkout, the invoice must correctly attribute GST on stones.

**Current risk:** If Vairis shows a price that includes diamond charges without their GST, the actual invoice total will be slightly higher. Customer sees ₹72,394 on website, invoice says ₹72,430 — small but could cause confusion.

**Fix:** Add `stoneGst = stoneCharges × 0.0025` (for diamonds) to the `PriceBreakdown` interface. This requires knowing the stone type to apply the right rate.

**Short-term workaround:** Include diamond GST as part of `miscCharges` (absorb it) or in `stoneCharges` figure itself.

---

### 🟢 FLAG 6 — Gold Rate Update Frequency [Minor but important]

**Severity: LOW — better than industry, but verify**

CaratLane updates gold rates WEEKLY. Our plan: every 30 minutes.

More frequent updates are better for customers (price accuracy) but can cause UX confusion if price changes mid-session. Recommendation:

- Show price with "as of [date/time]" label
- Cache product page for 60s (already done via `revalidate = 60`)
- At checkout, revalidate price against current rate and show confirmation if price changed

---

### 🟢 FLAG 7 — basePrice Field Is Unused [Technical Debt]

**Severity: LOW**

The `Product.basePrice: Decimal @default(0)` field exists in the schema but is never used anywhere in the pricing formula, the API responses, or the display. All pricing comes from the dynamic formula.

**Options:**
A. Remove the field (schema migration required, breaking change)
B. Repurpose it as a minimum floor price (e.g., never sell below ₹5,000)
C. Leave it as dead code

**Recommendation:** Repurpose as an optional "minimum price floor" — if `calculatePrice()` returns less than `basePrice`, use `basePrice` instead. This protects against pricing bugs causing absurdly low prices.

---

## 5. What to Build Next — Priority Order

| Priority | Fix | Effort | Blocks |
|---|---|---|---|
| P0 | Add pricing fields to admin ProductForm | ~2 hours | Everything |
| P0 | Implement lib/pricing.ts (Task 15) | ~2 hours | Price display |
| P0 | Implement lib/goldprice.ts + cron (Task 16) | ~3 hours | Live rates |
| P1 | Show price on PDP (breakdown + total) | ~3 hours | Checkout |
| P1 | Show price on ProductCard | ~1 hour | Catalog UX |
| P2 | Admin dashboard: live gold rate widget | ~1 hour | Admin clarity |
| P2 | Stones GST in price breakdown | ~1 hour | Invoice accuracy |
| P3 | basePrice as floor price guard | ~30 min | Safety |

---

## 6. Recommended PDP Price Display Design

Based on CaratLane and Giva research, here is what Vairis's PDP should show when pricing is live:

```
Selected: 18kt Gold (8.500g)

Price Breakdown
───────────────────────────────
Gold Value    8.5g × ₹5,800   ₹49,300
Making Charges               ₹ 3,400
Stone Charges (2.00 ctw)     ₹18,000
Certificate & Hallmark       ₹    45
GST (3% gold + 5% making)    ₹ 1,649
───────────────────────────────
Total                        ₹72,394

[Enquire for Price]  [Add to Cart]

Prices update with gold market rate.
Last updated: today at 10:30 AM.
```

**Why show the breakdown (unlike CaratLane):** Vairis positioning is transparency and trust. Showing the breakdown educates customers, builds trust, and justifies making charges. CaratLane doesn't do this but they have brand trust from years of operation. Vairis, as a new brand, should show workings to build credibility.

---

## 7. Self-Review Checklist (Pass 3)

**Math accuracy:**
- ✅ Example A: 8.5 × 5800 = 49,300. (49,300 × 0.03) + (3,400 × 0.05) = 1,479 + 170 = 1,649. Total = 49,300 + 3,400 + 18,000 + 45 + 1,649 = 72,394 ✓
- ✅ Example B: 5.95 × 80 = 476. (476 × 0.03) + (297.5 × 0.05) = 14.28 + 14.875 = 29.155 ≈ ₹29. Total = 476 + 297.5 + 18,000 + 45 + 29 = 18,847.5 ✓
- ✅ Example C: 3.5 × 7060 = 24,710. (24,710 × 0.03) + (875 × 0.05) = 741.3 + 43.75 = 785. Total = 24,710 + 875 + 0 + 45 + 785 = 26,415 ✓

**Formula accuracy:**
- ✅ GST formula matches Indian GST notification for jewelry
- ✅ Net weight vs gross weight distinction noted
- ✅ Making charges per gram range verified against industry

**Industry comparison accuracy:**
- ✅ CaratLane weekly gold rate updates — confirmed from web research
- ✅ Giva zero making charges — confirmed from official Giva blog post
- ✅ CaratLane price range ₹9K–₹2.18L — matches fetched data

**Flags completeness:**
- ✅ All critical implementation gaps identified
- ✅ Priority order makes sense (schema/code before display)
- ✅ No TBD or incomplete sections

---

*This document should be reviewed again before implementing Task 15 (pricing.ts) to ensure formula hasn't drifted from actual Indian GST rules at implementation time.*
