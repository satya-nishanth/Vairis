/**
 * Pricing — single source of truth for retail price computation.
 *
 * Matches the jewellery estimator (wastage on gold only, 3% GST on full taxable):
 *
 *   goldValue  = weight × goldRatePerGram
 *   wastage    = goldValue × vaGoldPct            (gold only; default 10%)
 *   making     = weight × makingChargePerGram + flatMakingCharge
 *   stoneValue = Σ stones(carat × per-carat rate[exchange]) + legacy stoneCharges [+ leadIncentive]
 *   taxable    = goldValue + wastage + making + stoneValue
 *              + misc + certification + packaging + delivery
 *   GST        = taxable × 3%
 *   total      = taxable + GST
 *
 * goldVA on the breakdown IS wastage (same field). stoneVA is always 0.
 * Wastage % + label come from PricingSettings (admin-editable; default label
 * "Value Addition"). Products may override both; null = inherit store defaults.
 * Certification / packaging / delivery: amounts + labels live on PricingSettings.
 * Null on ProductVariant inherits the store default amount (live — changing the
 * default updates all non-overridden products). Labels are store-wide and shown
 * on PDP, orders, and tax invoices. Each fee is its own line (not misc).
 * Diamond per-carat rates come from DiamondRate (with/without exchange).
 * Weights and carats shown to the customer are always the true values.
 */

import type { PromoKind } from '@prisma/client'
import {
  DEFAULT_MISC_LABEL,
  normalizeMiscChargeLines,
  resolveMiscChargeLines,
  sumMiscChargeLines,
  type MiscChargeLine,
} from '@/lib/misc-charges'

export type { MiscChargeLine }

export const GST_RATE = 0.03

/** Round INR to paise (2 decimal places). */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export interface PricingConfig {
  vaGoldPct: number
  vaStonePct: number
  vaLabel: string
  /** Store default amounts (₹). Null on a variant inherits these live. */
  defaultCertificationCharges: number
  defaultPackagingCharges: number
  defaultDeliveryCharges: number
  /** Customer-facing labels for the three fixed fees. */
  certificationLabel: string
  packagingLabel: string
  deliveryLabel: string
}

export const DEFAULT_FEE_LABELS = {
  certification: 'Certification',
  packaging: 'Packaging',
  delivery: 'Delivery',
} as const

export type FeeLabels = {
  certification: string
  packaging: string
  delivery: string
}

export function feeLabelsFromConfig(config: PricingConfig): FeeLabels {
  const cert = (config.certificationLabel || '').trim()
  const pack = (config.packagingLabel || '').trim()
  const del = (config.deliveryLabel || '').trim()
  return {
    certification: cert || DEFAULT_FEE_LABELS.certification,
    packaging: pack || DEFAULT_FEE_LABELS.packaging,
    delivery: del || DEFAULT_FEE_LABELS.delivery,
  }
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  vaGoldPct: 10,
  vaStonePct: 0,
  vaLabel: 'Value Addition',
  defaultCertificationCharges: 0,
  defaultPackagingCharges: 0,
  defaultDeliveryCharges: 0,
  certificationLabel: DEFAULT_FEE_LABELS.certification,
  packagingLabel: DEFAULT_FEE_LABELS.packaging,
  deliveryLabel: DEFAULT_FEE_LABELS.delivery,
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
    defaultCertificationCharges: store.defaultCertificationCharges,
    defaultPackagingCharges: store.defaultPackagingCharges,
    defaultDeliveryCharges: store.defaultDeliveryCharges,
    certificationLabel: store.certificationLabel,
    packagingLabel: store.packagingLabel,
    deliveryLabel: store.deliveryLabel,
  }
}

/**
 * Null / blank variant fee → PricingSettings default.
 * Explicit 0 (or any number) is kept as an override.
 */
export function resolveFixedCharge(
  raw: number | string | { toString(): string } | null | undefined,
  storeDefault: number,
): number {
  if (raw == null || raw === '') return Math.max(0, Number(storeDefault) || 0)
  const n = Number(raw)
  if (!Number.isFinite(n)) return Math.max(0, Number(storeDefault) || 0)
  return Math.max(0, n)
}

export function resolveFixedCharges(
  variant: {
    certificationCharges?: number | string | { toString(): string } | null
    packagingCharges?: number | string | { toString(): string } | null
    deliveryCharges?: number | string | { toString(): string } | null
  },
  store: Pick<
    PricingConfig,
    'defaultCertificationCharges' | 'defaultPackagingCharges' | 'defaultDeliveryCharges'
  >,
): {
  certificationCharges: number
  packagingCharges: number
  deliveryCharges: number
} {
  return {
    certificationCharges: resolveFixedCharge(
      variant.certificationCharges,
      store.defaultCertificationCharges,
    ),
    packagingCharges: resolveFixedCharge(variant.packagingCharges, store.defaultPackagingCharges),
    deliveryCharges: resolveFixedCharge(variant.deliveryCharges, store.defaultDeliveryCharges),
  }
}

/** Persist: empty → inherit (null); value equal to store default → null; else explicit. */
export function encodeFixedChargeForSave(
  value: string | number | null | undefined,
  storeDefault: number,
): number | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return null
  if (roundMoney(n) === roundMoney(Number(storeDefault) || 0)) return null
  return n
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
  /** Fixed fees (₹) — each disclosed as its own line. */
  certificationCharges: number
  packagingCharges: number
  deliveryCharges: number
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
  /** Labeled misc / hallmark / delivery rows (unit amounts). Sum ≈ miscCharges. */
  miscLines?: MiscChargeLine[]
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
    /** Order-level labeled misc rows (text + amount). Sum becomes miscCharges. */
    miscLines?: MiscChargeLine[]
    /** Order-level first-class fixed fees (₹). */
    certification?: number
    packaging?: number
    delivery?: number
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
  const orderMiscLines = normalizeMiscChargeLines(selling.miscLines)
  const orderMiscTotal = sumMiscChargeLines(orderMiscLines)
  const miscCharges = orderMiscTotal / q
  const miscLines = orderMiscLines.map((l) => ({
    label: l.label,
    amount: l.amount / q,
  }))
  const certificationCharges = Math.max(0, selling.certification ?? 0) / q
  const packagingCharges = Math.max(0, selling.packaging ?? 0) / q
  const deliveryCharges = Math.max(0, selling.delivery ?? 0) / q
  const gst = selling.gst / q
  const taxable =
    goldValue +
    goldVA +
    making +
    stoneValue +
    miscCharges +
    certificationCharges +
    packagingCharges +
    deliveryCharges
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
      certificationCharges,
      packagingCharges,
      deliveryCharges,
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
  const withMisc: OrderItemPriceSnapshot =
    miscLines.length > 0 ? { ...snap, miscLines } : snap
  if (autoDiscount <= 0) return withMisc
  return {
    ...withMisc,
    autoDiscount,
    autoDiscountLabel: 'Discount',
    payable: Math.max(0, withMisc.total - autoDiscount),
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
 * snapshots with only stoneValue put the lump on Diamonds.
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
    miscLines?: MiscChargeLine[]
    certificationCharges?: number
    packagingCharges?: number
    deliveryCharges?: number
  },
  quantity: number,
): {
  gold: number
  diamonds: number
  stones: number
  making: number
  wastage: number
  certification: number
  packaging: number
  delivery: number
  gst: number
  discount: number
  miscLines: MiscChargeLine[]
} {
  const q = Math.max(1, quantity)
  const gems = splitGemValues(snapshot)
  // Prefer explicit miscLines; legacy flat miscCharges → single "Misc" row (not Hallmark).
  const miscLines = resolveMiscChargeLines(
    snapshot.miscLines,
    Number(snapshot.miscCharges) || 0,
    DEFAULT_MISC_LABEL,
  ).map((l) => ({
    label: l.label,
    amount: roundMoney(l.amount * q),
  }))
  // Only autoDiscount — coupon stays on Order.discountBreakdown / snapshot.coupon*.
  return {
    gold: roundMoney(snapshot.goldValue * q),
    diamonds: roundMoney(gems.diamonds * q),
    stones: roundMoney(gems.stones * q),
    making: roundMoney(snapshot.making * q),
    wastage: roundMoney((snapshot.goldVA + (snapshot.stoneVA ?? 0)) * q),
    certification: roundMoney((snapshot.certificationCharges ?? 0) * q),
    packaging: roundMoney((snapshot.packagingCharges ?? 0) * q),
    delivery: roundMoney((snapshot.deliveryCharges ?? 0) * q),
    gst: roundMoney(snapshot.gst * q),
    discount: roundMoney((snapshot.autoDiscount ?? 0) * q),
    miscLines,
  }
}

/**
 * Selling breakdown matches goods when net equals (manual: unit prices are
 * post-discount) or gross equals (checkout: unit prices are pre-discount).
 *
 * On create (`requireNetIfDiscounted`), a positive discount may only match
 * net — otherwise grandTotal would capture gross while discountAmount is also
 * stored (overcharge). Edits keep the gross option so checkout orders still save.
 */
export function sellingBreakdownMatchesGoods(
  selling: {
    gold: number
    diamonds: number
    stones: number
    making: number
    wastage: number
    miscLines?: MiscChargeLine[]
    certification?: number
    packaging?: number
    delivery?: number
    gst: number
    discount?: number
  },
  goodsTotal: number,
  opts?: { requireNetIfDiscounted?: boolean },
): boolean {
  const misc = sumMiscChargeLines(normalizeMiscChargeLines(selling.miscLines))
  const gross =
    selling.gold +
    selling.diamonds +
    selling.stones +
    selling.making +
    selling.wastage +
    misc +
    (selling.certification ?? 0) +
    (selling.packaging ?? 0) +
    (selling.delivery ?? 0) +
    selling.gst
  const discount = selling.discount ?? 0
  const paise = (n: number) => Math.round(n * 100)
  const goods = paise(goodsTotal)
  const netOk = paise(gross - discount) === goods
  if (opts?.requireNetIfDiscounted && discount > 0) return netOk
  return netOk || paise(gross) === goods
}

/** Order-level misc total from labeled rows only (not delivery). */
export function sellingBreakdownMiscTotal(selling: { miscLines?: MiscChargeLine[] }): number {
  return sumMiscChargeLines(normalizeMiscChargeLines(selling.miscLines))
}

/** Pre-discount gross for admin selling breakdown validation / error messages. */
export function sellingBreakdownGross(
  selling: Parameters<typeof sellingBreakdownMatchesGoods>[0],
): number {
  return (
    selling.gold +
    selling.diamonds +
    selling.stones +
    selling.making +
    selling.wastage +
    sellingBreakdownMiscTotal(selling) +
    (selling.certification ?? 0) +
    (selling.packaging ?? 0) +
    (selling.delivery ?? 0) +
    selling.gst
  )
}

export interface VariantPriceInput {
  weightGrams: number | string
  makingChargePerGram: number | string
  flatMakingCharge: number | string
  /** Legacy flat stone cost — still honoured for products without stone rows. */
  stoneCharges: number | string
  miscCharges: number | string
  /** Fixed fees (₹). Null/omit → PricingConfig store defaults; explicit 0 kept. */
  certificationCharges?: number | string | { toString(): string } | null
  packagingCharges?: number | string | { toString(): string } | null
  deliveryCharges?: number | string | { toString(): string } | null
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

  const misc = Number(variant.miscCharges) || 0
  // Null/blank → store defaults from PricingConfig; explicit 0 is an override.
  const fixed = resolveFixedCharges(
    {
      certificationCharges: variant.certificationCharges,
      packagingCharges: variant.packagingCharges,
      deliveryCharges: variant.deliveryCharges,
    },
    config,
  )
  const stoneVA = 0
  const taxable =
    goldValue +
    goldVA +
    making +
    stoneValue +
    misc +
    fixed.certificationCharges +
    fixed.packagingCharges +
    fixed.deliveryCharges
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
    certificationCharges: fixed.certificationCharges,
    packagingCharges: fixed.packagingCharges,
    deliveryCharges: fixed.deliveryCharges,
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
