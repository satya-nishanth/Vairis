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
 * Wastage % + label come from PricingSettings (admin-editable).
 * Diamond per-carat rates come from DiamondRate (with/without exchange).
 * Weights and carats shown to the customer are always the true values.
 */

export const GST_RATE = 0.03

export interface PricingConfig {
  vaGoldPct: number
  vaStonePct: number
  vaLabel: string
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  vaGoldPct: 10,
  vaStonePct: 0,
  vaLabel: 'Wastage',
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

export interface PriceBreakdown {
  goldValue: number
  /** Wastage on gold value (legacy field name goldVA). */
  goldVA: number
  making: number
  stoneValue: number
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
  capturedAt: string
}

export function toOrderItemPriceSnapshot(
  breakdown: PriceBreakdown,
  meta: { goldRatePerGram: number; weightGrams: number; metalType?: string },
): OrderItemPriceSnapshot {
  return {
    ...breakdown,
    goldRatePerGram: meta.goldRatePerGram,
    weightGrams: meta.weightGrams,
    metalType: meta.metalType,
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
  const stoneValue = (selling.diamonds + selling.stones) / q
  const miscCharges = selling.delivery / q
  const gst = selling.gst / q
  const taxable = goldValue + goldVA + making + stoneValue + miscCharges
  const total = taxable + gst
  return toOrderItemPriceSnapshot(
    {
      goldValue,
      goldVA,
      making,
      stoneValue,
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
  const stoneValue =
    stoneLines.reduce((sum, l) => sum + l.value, 0) + legacyStones + leadIncentive

  const misc = Number(variant.miscCharges)
  const stoneVA = 0
  const taxable = goldValue + goldVA + making + stoneValue + misc
  const gst = taxable * GST_RATE

  return {
    goldValue,
    goldVA,
    making,
    stoneValue,
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
