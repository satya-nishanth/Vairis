/**
 * Pricing — single source of truth for retail price computation.
 *
 * Matches the jewellery estimator (wastage on gold only, 3% GST on full taxable):
 *
 *   goldValue  = weight × goldRatePerGram
 *   wastage    = goldValue × vaGoldPct            (gold only; default 10%)
 *   making     = weight × makingChargePerGram + flatMakingCharge
 *   stoneValue = Σ stones(carat × per-carat rate[exchange]) + legacy stoneCharges [+ leadIncentive]
 *   taxable    = goldValue + wastage + making + stoneValue + misc
 *   GST        = taxable × 3%
 *   total      = taxable + GST
 *
 * goldVA on the breakdown IS wastage (same field). stoneVA is always 0.
 * Wastage % + label come from PricingSettings (admin-editable; default label
 * "Value Addition"). Products may override both; null = inherit store defaults.
 * Diamond per-carat rates come from DiamondRate (with/without exchange).
 * Weights and carats shown to the customer are always the true values.
 */

import type { PromoKind } from '@prisma/client'

export const GST_RATE = 0.03

/** Round INR to paise (2 decimal places). */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export interface PricingConfig {
  vaGoldPct: number
  vaStonePct: number
  vaLabel: string
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  vaGoldPct: 10,
  vaStonePct: 0,
  vaLabel: 'Value Addition',
}

/** Optional per-product override of store wastage % / label (null = inherit). */
export type PricingOverride = {
  /** Accepts Prisma Decimal via Number()/toString. */
  vaGoldPct?: number | string | { toString(): string } | null
  vaLabel?: string | null
}

/** Merge store PricingSettings with a product's optional wastage override. */
export function resolvePricingConfig(
  store: PricingConfig,
  override?: PricingOverride | null,
): PricingConfig {
  const rawPct = override?.vaGoldPct
  const hasPct =
    rawPct !== null &&
    rawPct !== undefined &&
    rawPct !== '' &&
    !Number.isNaN(Number(rawPct))
  const label = typeof override?.vaLabel === 'string' ? override.vaLabel.trim() : ''
  return {
    vaGoldPct: hasPct ? Number(rawPct) : store.vaGoldPct,
    vaStonePct: store.vaStonePct,
    vaLabel: label || store.vaLabel,
  }
}

export interface StoneInput {
  /** Carat weight of this stone entry (true value, shown to customer). */
  caratWeight: number | string
  /** Per-carat rate WITHOUT exchange (from DiamondRate.ratePerCarat). */
  ratePerCarat: number | string
  /** Per-carat rate WITH exchange (from DiamondRate.ratePerCaratExchange). */
  ratePerCaratExchange: number | string
  /** Display label, e.g. "Colourless Diamond". */
  typeLabel?: string
}

export interface StoneLine {
  typeLabel: string
  caratWeight: number
  ratePerCarat: number
  value: number
}

/** Labels that count as diamonds (vs other stones) for breakdown / finance split. */
export function isDiamondTypeLabel(label: string | null | undefined): boolean {
  const t = (label ?? '').trim().toLowerCase()
  if (!t) return true
  // Explicit non-diamond gems — everything else (incl. fancy/coloured diamond) is diamond.
  if (
    /\b(ruby|sapphire|emerald|pearl|coral|opal|garnet|amethyst|topaz|turquoise|cubic|cz)\b/.test(t)
  ) {
    return false
  }
  if (/\b(colour|color)\s*stone\b/.test(t) || /\bgem\s*stone\b/.test(t)) return false
  return true
}

/** Split total gem cost into diamonds vs other stones. */
export function splitGemValues(b: {
  stoneValue: number
  diamondValue?: number | null
  otherStoneValue?: number | null
  stoneLines?: { typeLabel: string; value: number }[] | null
}): { diamonds: number; stones: number } {
  if (b.diamondValue != null || b.otherStoneValue != null) {
    const diamonds = Number(b.diamondValue ?? 0)
    const stones =
      b.otherStoneValue != null
        ? Number(b.otherStoneValue)
        : Math.max(0, Number(b.stoneValue) - diamonds)
    return { diamonds, stones }
  }
  const lines = b.stoneLines ?? []
  if (lines.length > 0) {
    let diamonds = 0
    let stones = 0
    for (const line of lines) {
      if (isDiamondTypeLabel(line.typeLabel)) diamonds += Number(line.value) || 0
      else stones += Number(line.value) || 0
    }
    const leftover = Math.max(0, Number(b.stoneValue) - (diamonds + stones))
    // Legacy flat / lead incentive not in lines → other stones
    return { diamonds, stones: stones + leftover }
  }
  // Legacy snapshots: entire gem lump on stoneValue — treat as diamonds
  // (prior finance mapping) so Stones stays 0 until re-saved with a split.
  return { diamonds: Number(b.stoneValue) || 0, stones: 0 }
}

export interface PriceBreakdown {
  goldValue: number
  /** Wastage on gold value (legacy field name goldVA). */
  goldVA: number
  making: number
  /** Total gem cost (diamonds + other stones + legacy flat). */
  stoneValue: number
  /** Diamond portion of stoneValue (explicit when known). */
  diamondValue: number
  /** Non-diamond / coloured-stone portion of stoneValue. */
  otherStoneValue: number
  stoneLines: StoneLine[]
  /** Always 0 — stone VA is not part of the estimator formula. */
  stoneVA: number
  vaTotal: number
  vaLabel: string
  miscCharges: number
  taxable: number
  gst: number
  total: number
  withExchange: boolean
}

/**
 * Frozen at OrderItem create time (checkout / admin). Stored as OrderItem.priceBreakdown.
 * Includes gold rate + weight so the snapshot is self-contained after rates change.
 */
export type OrderItemPriceSnapshot = PriceBreakdown & {
  goldRatePerGram: number
  weightGrams: number
  metalType?: string
  metalColor?: string
  capturedAt: string
  /** Post-GST automatic discount allocated to this unit (₹). Optional on legacy rows. */
  autoDiscount?: number
  autoDiscountPercent?: number
  autoDiscountLabel?: string
  /** Post-GST coupon discount allocated to this unit (₹). Optional on legacy rows. */
  couponDiscount?: number
  couponDiscountPercent?: number
  couponCode?: string
  couponKind?: PromoKind
  /** max(0, total − autoDiscount − couponDiscount). Optional on legacy rows. */
  payable?: number
}

export function toOrderItemPriceSnapshot(
  breakdown: PriceBreakdown,
  meta: {
    goldRatePerGram: number
    weightGrams: number
    metalType?: string
    metalColor?: string
  },
): OrderItemPriceSnapshot {
  return {
    ...breakdown,
    goldRatePerGram: meta.goldRatePerGram,
    weightGrams: meta.weightGrams,
    metalType: meta.metalType,
    metalColor: meta.metalColor,
    capturedAt: new Date().toISOString(),
  }
}

/**
 * Build a unit price snapshot from admin-entered selling components
 * (order-level amounts ÷ quantity). Maps finance-style line labels into
 * PriceBreakdown fields used by order detail / finance quotes.
 */
export function sellingComponentsToUnitSnapshot(
  selling: {
    gold: number
    diamonds: number
    stones: number
    making: number
    wastage: number
    delivery: number
    gst: number
    /** Order-level discount (₹) subtracted after GST — maps to autoDiscount on the unit. */
    discount?: number
  },
  meta: {
    quantity: number
    goldRatePerGram: number
    weightGrams: number
    metalType?: string
    vaLabel?: string
  },
): OrderItemPriceSnapshot {
  const q = Math.max(1, meta.quantity)
  const goldValue = selling.gold / q
  const goldVA = selling.wastage / q
  const making = selling.making / q
  const diamondValue = selling.diamonds / q
  const otherStoneValue = selling.stones / q
  const stoneValue = diamondValue + otherStoneValue
  const miscCharges = selling.delivery / q
  const gst = selling.gst / q
  const taxable = goldValue + goldVA + making + stoneValue + miscCharges
  const total = taxable + gst
  const autoDiscount = Math.max(0, (selling.discount ?? 0) / q)
  const snap = toOrderItemPriceSnapshot(
    {
      goldValue,
      goldVA,
      making,
      stoneValue,
      diamondValue,
      otherStoneValue,
      stoneLines: [],
      stoneVA: 0,
      vaTotal: goldVA,
      vaLabel: meta.vaLabel || DEFAULT_PRICING_CONFIG.vaLabel,
      miscCharges,
      taxable,
      gst,
      total,
      withExchange: false,
    },
    {
      goldRatePerGram: meta.goldRatePerGram,
      weightGrams: meta.weightGrams,
      metalType: meta.metalType,
    },
  )
  if (autoDiscount <= 0) return snap
  return {
    ...snap,
    autoDiscount,
    autoDiscountLabel: 'Discount',
    payable: Math.max(0, snap.total - autoDiscount),
  }
}

/** True when a JSON column looks like a usable price snapshot. */
export function isOrderItemPriceSnapshot(v: unknown): v is OrderItemPriceSnapshot {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.total === 'number' &&
    typeof o.goldValue === 'number' &&
    typeof o.goldVA === 'number' &&
    typeof o.making === 'number' &&
    typeof o.stoneValue === 'number' &&
    typeof o.gst === 'number'
  )
}

/**
 * Reverse of sellingComponentsToUnitSnapshot — order-level amounts for the
 * admin edit form. Uses diamondValue / otherStoneValue when present; legacy
 * snapshots with only stoneValue put the lump on Diamonds. Delivery ← miscCharges.
 */
export function unitSnapshotToSellingComponents(
  snapshot: Pick<
    OrderItemPriceSnapshot,
    'goldValue' | 'goldVA' | 'making' | 'stoneValue' | 'miscCharges' | 'gst'
  > & {
    stoneVA?: number
    diamondValue?: number
    otherStoneValue?: number
    stoneLines?: { typeLabel: string; value: number }[]
    autoDiscount?: number
  },
  quantity: number,
): {
  gold: number
  diamonds: number
  stones: number
  making: number
  wastage: number
  delivery: number
  gst: number
  discount: number
} {
  const q = Math.max(1, quantity)
  const gems = splitGemValues(snapshot)
  // Only autoDiscount — coupon stays on Order.discountBreakdown / snapshot.coupon*.
  return {
    gold: roundMoney(snapshot.goldValue * q),
    diamonds: roundMoney(gems.diamonds * q),
    stones: roundMoney(gems.stones * q),
    making: roundMoney(snapshot.making * q),
    wastage: roundMoney((snapshot.goldVA + (snapshot.stoneVA ?? 0)) * q),
    delivery: roundMoney(snapshot.miscCharges * q),
    gst: roundMoney(snapshot.gst * q),
    discount: roundMoney((snapshot.autoDiscount ?? 0) * q),
  }
}

/** Selling breakdown matches goods when net equals (manual) or gross equals (checkout pre-discount prices). */
export function sellingBreakdownMatchesGoods(
  selling: {
    gold: number
    diamonds: number
    stones: number
    making: number
    wastage: number
    delivery: number
    gst: number
    discount?: number
  },
  goodsTotal: number,
): boolean {
  const gross =
    selling.gold +
    selling.diamonds +
    selling.stones +
    selling.making +
    selling.wastage +
    selling.delivery +
    selling.gst
  const discount = selling.discount ?? 0
  const paise = (n: number) => Math.round(n * 100)
  const goods = paise(goodsTotal)
  return paise(gross - discount) === goods || paise(gross) === goods
}

export interface VariantPriceInput {
  weightGrams: number | string
  makingChargePerGram: number | string
  flatMakingCharge: number | string
  /** Legacy flat stone cost — still honoured for products without stone rows. */
  stoneCharges: number | string
  miscCharges: number | string
}

export function calculatePrice(
  variant: VariantPriceInput,
  goldRatePerGram: number,
  options?: {
    stones?: StoneInput[]
    withExchange?: boolean
    config?: PricingConfig
    leadIncentive?: number
  },
): PriceBreakdown {
  const config = options?.config ?? DEFAULT_PRICING_CONFIG
  const withExchange = options?.withExchange ?? false
  const stones = options?.stones ?? []
  const leadIncentive = Number(options?.leadIncentive ?? 0)

  const weight = Number(variant.weightGrams)
  const goldValue = weight * goldRatePerGram
  const goldVA = goldValue * (Number(config.vaGoldPct) / 100)
  const making = weight * Number(variant.makingChargePerGram) + Number(variant.flatMakingCharge)

  const stoneLines: StoneLine[] = stones.map((s) => {
    const rate = Number(withExchange ? s.ratePerCaratExchange : s.ratePerCarat)
    const carat = Number(s.caratWeight)
    return {
      typeLabel: s.typeLabel ?? 'Diamond',
      caratWeight: carat,
      ratePerCarat: rate,
      value: carat * rate,
    }
  })
  const legacyStones = Number(variant.stoneCharges)
  let diamondValue = 0
  let otherStoneValue = 0
  for (const line of stoneLines) {
    if (isDiamondTypeLabel(line.typeLabel)) diamondValue += line.value
    else otherStoneValue += line.value
  }
  otherStoneValue += legacyStones + leadIncentive
  const stoneValue = diamondValue + otherStoneValue

  const misc = Number(variant.miscCharges)
  const stoneVA = 0
  const taxable = goldValue + goldVA + making + stoneValue + misc
  const gst = taxable * GST_RATE

  return {
    goldValue,
    goldVA,
    making,
    stoneValue,
    diamondValue,
    otherStoneValue,
    stoneLines,
    stoneVA,
    vaTotal: goldVA,
    vaLabel: config.vaLabel || DEFAULT_PRICING_CONFIG.vaLabel,
    miscCharges: misc,
    taxable,
    gst,
    total: taxable + gst,
    withExchange,
  }
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}
