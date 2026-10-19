# Fixed charges & fee labels (17 Oct 2026)

Shipped to **preprod** (`stage_preprod`, commit `139cd97`).  
Covers certification, packaging, and delivery as first-class price lines — with store defaults, live inherit, and editable names.

---

## Summary

| Area | Change |
|------|--------|
| Pricing formula | Three fixed fees sit in taxable (with gold, wastage, making, stones, misc), then 3% GST |
| Store defaults | Amounts + labels edited under **Admin → Settings → Pricing** |
| Product inherit | Blank / null on a variant = use store default **live** (changing the default updates those products) |
| Product override | Any explicit amount (including `0`) on the product wins |
| Labels | Same names appear on PDP, admin orders, and tax invoices |
| Misc | Optional text + amount lines; UI placed **after** the three fixed fees |

Misc is **not** used for hallmark / packaging / delivery anymore. Those are their own lines.
Migration `20261019180000_clear_legacy_hallmark_misc` clears the old flat ₹45 hallmark
misc on variants so it is not charged on top of Certification.

---

## Pricing formula (unchanged structure)

```
goldValue  = weight × goldRatePerGram
wastage    = goldValue × vaGoldPct          (gold only)
making     = weight × makingChargePerGram + flatMakingCharge
stoneValue = Σ diamonds/stones + legacy stoneCharges
taxable    = gold + wastage + making + stones + misc
           + certification + packaging + delivery
GST        = taxable × 3%
total      = taxable + GST
```

Each of certification / packaging / delivery is disclosed as its own breakup line (not folded into misc).

---

## Admin: Pricing Settings

**Path:** `/admin/settings/pricing` → section **Fixed charges (defaults + labels)**

For each of the three fees you can set:

1. **Label** — customer-facing name (max 40 chars)  
   Defaults: `Certification`, `Packaging`, `Delivery`
2. **Default amount (₹)** — used wherever a product has not set its own value

### Behaviour when you change a default amount

- Products with the field **blank / null** → pick up the new amount immediately (PDP, new orders, new invoice lines from catalogue).
- Products with an **explicit** amount different from “inherit” → unchanged.
- Saving a product: blank field, or a value equal to the current store default, is stored as **null** (inherit). Typing `0` when the store default is non-zero is stored as an explicit override (free for that product).

### Behaviour when you change a label

- PDP breakup, admin order selling breakdown, invoice composer, and printed tax invoice use the new names.
- Existing locked order snapshots keep their **amounts**; labels shown in admin/order UI follow current Pricing Settings (composer prefers live labels; saved invoices stamp labels at save time for print).

---

## Product page (admin)

On each variant under Build / price:

- Three fee fields with placeholders = current store defaults.
- Hint: **Blank = store default (₹…)**.
- Misc (optional labeled lines) is below those three fields.

---

## Orders (admin)

Manual order create / edit selling breakdown order:

1. Gold, Diamonds, Stones, Making, Wastage  
2. Certification / Packaging / Delivery (using **current labels**)  
3. GST, Discount  
4. Misc lines (+ Add misc line)

Selecting a catalogue variant prefills the three fees from the **resolved** amounts (inherit or override).

Order detail read-only breakup uses the same labels and shows misc after the three fees, before taxable / GST.

---

## Invoices

- Composer line editor: fee fields use Pricing Settings labels; misc editor is after diamonds / fixed fees.
- Print view: fee line names from `payload.feeLabels` (stamped on create/save), with safe fallbacks.
- Blank new invoice is initialised with live store labels (not hardcoded English defaults only).

---

## Storefront (PDP)

Price breakup shows the three fees (when > 0) using store labels, after wastage / making and before GST. Misc (if any) remains its own line.

---

## Database

| Migration | Purpose |
|-----------|---------|
| `20261017130000_variant_certification_charges` | Certification column (earlier) |
| `20261017140000_fixed_charges_packaging_delivery` | Packaging / delivery columns + store default amounts |
| `20261017150000_fixed_charges_nullable_inherit` | Fees nullable; existing `0` → `null` (inherit) |
| `20261017160000_fixed_charge_labels` | `certificationLabel`, `packagingLabel`, `deliveryLabel` on `PricingSettings` |

### Schema sketch

**PricingSettings**

- `defaultCertificationCharges` / `defaultPackagingCharges` / `defaultDeliveryCharges`
- `certificationLabel` / `packagingLabel` / `deliveryLabel`

**ProductVariant**

- `certificationCharges` / `packagingCharges` / `deliveryCharges` — `Decimal?` (`null` = inherit)

Preprod applies migrations on container boot.

---

## Code map (for engineers)

| Concern | Where |
|---------|--------|
| Formula + resolve / encode inherit | `lib/pricing.ts` (`resolveFixedCharge*`, `encodeFixedChargeForSave`, `feeLabelsFromConfig`) |
| Load store config | `lib/pricing-data.ts` → `getPricingConfig()` |
| Invoice build / labels on payload | `lib/invoice-document.ts`, `lib/invoice-build.ts` |
| Pricing Settings UI + API | `app/(admin)/admin/settings/pricing/*`, `app/api/admin/settings/pricing/route.ts` |
| Product form | `components/admin/ProductForm.tsx`, `AdminProductBuildPrice.tsx` |
| Orders | `ManualOrderForm.tsx`, order detail / new / edit pages |
| PDP | `app/product/[id]/ProductPageClient.tsx` |
| Tests | `__tests__/lib/pricing.test.ts` (inherit + encode + labels) |

---

## Ops checklist (preprod / later prod)

1. Open **Pricing Settings** — set the three default amounts and labels as you want them shown to customers.
2. Spot-check a few products: blank fee fields should show the store default in the live preview; products that need a different amount should be filled in explicitly.
3. Create a manual order → confirm selling breakdown labels and prefilled fee amounts.
4. Create / print an invoice → confirm fee line names and amounts.
5. Open a PDP with price shown → confirm breakup labels.

Existing **paid orders** keep frozen `priceBreakdown` amounts; only new calculations and display labels follow the new settings.

---

## Related commits

| Commit | Note |
|--------|------|
| `5fd0ff0` | Certification as first-class fee |
| `027b0a3` | Packaging + delivery + store default amounts |
| `139cd97` | Nullable inherit + editable labels; misc last in editors |
