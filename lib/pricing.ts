/**
 * Pricing v2 — single source of truth for retail price computation.
 *
 * total = goldValue + goldVA + making + stoneValue + stoneVA + misc + GST
 *
 *   goldValue  = weight × goldRatePerGram          (true weight, always)
 *   goldVA     = goldValue × vaGoldPct             (disclosed Value Addition line)
 *   making     = weight × makingChargePerGram + flatMakingCharge
 *   stoneValue = Σ stones(carat × per-carat rate[exchange]) + legacy flat stoneCharges
 *   stoneVA    = stoneValue × vaStonePct           (disclosed)
 *   GST        = (goldValue + goldVA + stoneValue + stoneVA) × 3% + making × 5%
 *
 * VA percentages + label come from PricingSettings (admin-editable).
 * Diamond per-carat rates come from DiamondRate (with/without exchange).
 * Every number shown to the customer is real — weights and carats are never
 * adjusted. VA is a visible line on the breakup.
 */

export interface PricingConfig {
  vaGoldPct: number
  vaStonePct: number
  vaLabel: string
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  vaGoldPct: 5,
  vaStonePct: 5,
  vaLabel: 'Value Addition',
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
  goldVA: number
  making: number
  stoneValue: number
  stoneLines: StoneLine[]
  stoneVA: number
  vaTotal: number
  vaLabel: string
  miscCharges: number
  gst: number
  total: number
  withExchange: boolean
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
  },
): PriceBreakdown {
  const config = options?.config ?? DEFAULT_PRICING_CONFIG
  const withExchange = options?.withExchange ?? false
  const stones = options?.stones ?? []

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
  const stoneValue = stoneLines.reduce((sum, l) => sum + l.value, 0) + legacyStones
  const stoneVA = stoneValue * (Number(config.vaStonePct) / 100)

  const misc = Number(variant.miscCharges)
  const gst = (goldValue + goldVA + stoneValue + stoneVA) * 0.03 + making * 0.05

  return {
    goldValue,
    goldVA,
    making,
    stoneValue,
    stoneLines,
    stoneVA,
    vaTotal: goldVA + stoneVA,
    vaLabel: config.vaLabel,
    miscCharges: misc,
    gst,
    total: goldValue + goldVA + making + stoneValue + stoneVA + misc + gst,
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
