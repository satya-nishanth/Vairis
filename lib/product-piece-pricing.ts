import type { GoldRate, ProductVariant } from '@prisma/client'
import {
  calculatePrice,
  toOrderItemPriceSnapshot,
  type OrderItemPriceSnapshot,
  type PriceBreakdown,
  type PricingConfig,
} from '@/lib/pricing'
import {
  resolvePiecePricingConfig,
  stonesForVariant,
  toStoneInputs,
  type PricingOverride,
  type StoneWithRate,
} from '@/lib/pricing-data'

type VariantLike = Pick<
  ProductVariant,
  | 'id'
  | 'pieceId'
  | 'metalType'
  | 'metalColor'
  | 'weightGrams'
  | 'makingChargePerGram'
  | 'flatMakingCharge'
  | 'stoneCharges'
  | 'miscCharges'
  | 'certificationCharges'
  | 'packagingCharges'
  | 'deliveryCharges'
>

function metalKey(v: Pick<VariantLike, 'metalType' | 'metalColor'>): string {
  return `${v.metalType}:${v.metalColor ?? 'YELLOW'}`
}

function sameMetal(
  a: Pick<VariantLike, 'metalType' | 'metalColor'>,
  b: Pick<VariantLike, 'metalType' | 'metalColor'>,
): boolean {
  return metalKey(a) === metalKey(b)
}

type PieceLike = {
  id: string
  name?: string
  vaGoldPct?: PricingOverride['vaGoldPct']
  vaLabel?: PricingOverride['vaLabel']
}

/**
 * Live unit price for one catalogue variant using its piece's stones + VA.
 * Falls back to product-level stones/VA when piece data is missing.
 */
export function priceVariantUnit(
  variant: VariantLike,
  ratePerGram: number | undefined,
  storePricing: PricingConfig,
  allStones: StoneWithRate[],
  productOverride?: PricingOverride | null,
  piece?: PieceLike | null,
  withExchange = false,
): number | null {
  if (!ratePerGram) return null
  const weight = Number(variant.weightGrams)
  if (!(weight > 0)) return null
  const config = resolvePiecePricingConfig(storePricing, productOverride, piece ?? null)
  const stones = toStoneInputs(stonesForVariant(allStones, variant.pieceId))
  const total = calculatePrice(
    {
      weightGrams: weight,
      makingChargePerGram: Number(variant.makingChargePerGram),
      flatMakingCharge: Number(variant.flatMakingCharge),
      stoneCharges: Number(variant.stoneCharges),
      miscCharges: Number(variant.miscCharges),
      certificationCharges: Number(variant.certificationCharges ?? 0),
      packagingCharges: Number(variant.packagingCharges ?? 0),
      deliveryCharges: Number(variant.deliveryCharges ?? 0),
    },
    ratePerGram,
    { stones, withExchange, config },
  ).total
  return Math.round(total)
}

/**
 * PLP / set "from" price:
 * - one piece → cheapest variant
 * - multi-piece set → sum of cheapest variant per piece (display total for one product)
 */
export function computeCatalogueFromPrice(
  variants: VariantLike[],
  goldRates: GoldRate[],
  storePricing: PricingConfig,
  allStones: StoneWithRate[],
  productOverride?: PricingOverride | null,
  pieces?: PieceLike[] | null,
): { price: number; variantId: string; hasMultiplePrices: boolean } | null {
  const rateMap = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))
  const pieceById = new Map((pieces ?? []).map((p) => [p.id, p]))

  const pieceKeys = [...new Set(variants.map((v) => v.pieceId || '_default'))]
  const multiPiece = pieceKeys.length > 1 && pieceKeys.some((k) => k !== '_default')

  if (!multiPiece) {
    const priced = variants
      .map((v) => {
        const piece = v.pieceId ? pieceById.get(v.pieceId) : null
        const total = priceVariantUnit(
          v,
          rateMap[v.metalType],
          storePricing,
          allStones,
          productOverride,
          piece,
          false,
        )
        return total == null ? null : { id: v.id, total }
      })
      .filter((x): x is { id: string; total: number } => x !== null)
    if (!priced.length) return null
    const cheapest = priced.reduce((a, b) => (b.total < a.total ? b : a))
    const mostExpensive = priced.reduce((a, b) => (b.total > a.total ? b : a))
    return {
      price: cheapest.total,
      variantId: cheapest.id,
      hasMultiplePrices: priced.length > 1 && cheapest.total !== mostExpensive.total,
    }
  }

  // Multi-piece = one sellable product. Prefer purity+color that exist on every piece.
  const metalOpts = [...new Set(variants.map((v) => metalKey(v)))]
  let best: { price: number; variantId: string } | null = null
  for (const opt of metalOpts) {
    let sum = 0
    let primaryId: string | null = null
    let ok = true
    for (const key of pieceKeys) {
      const group = variants.filter((v) => (v.pieceId || '_default') === key)
      const piece = key !== '_default' ? pieceById.get(key) : null
      const v = group.find((x) => metalKey(x) === opt)
      if (!v) {
        ok = false
        break
      }
      const total = priceVariantUnit(
        v,
        rateMap[v.metalType],
        storePricing,
        allStones,
        productOverride,
        piece,
        false,
      )
      if (total == null) {
        ok = false
        break
      }
      sum += total
      if (!primaryId) primaryId = v.id
    }
    if (!ok || !primaryId) continue
    if (!best || sum < best.price) best = { price: sum, variantId: primaryId }
  }
  if (!best) return null
  return { price: best.price, variantId: best.variantId, hasMultiplePrices: metalOpts.length > 1 }
}

/**
 * Unit price for cart/checkout: one line item.
 * Multi-piece products charge the full set total (sum of pieces at this metal).
 */
export function priceCartVariantUnit(
  selected: VariantLike,
  allVariants: VariantLike[],
  rateMap: Record<string, number>,
  storePricing: PricingConfig,
  allStones: StoneWithRate[],
  productOverride?: PricingOverride | null,
  pieces?: PieceLike[] | null,
  withExchange = false,
): number | null {
  const built = buildSetPriceBreakdown(
    selected,
    allVariants,
    rateMap,
    storePricing,
    allStones,
    productOverride,
    pieces,
    withExchange,
  )
  return built ? Math.round(built.breakdown.total) : null
}

/**
 * Full set breakdown for PDP / checkout snapshot.
 * Multi-piece = one sellable line; amounts are summed across pieces.
 */
export function buildSetPriceBreakdown(
  selected: VariantLike,
  allVariants: VariantLike[],
  rateMap: Record<string, number>,
  storePricing: PricingConfig,
  allStones: StoneWithRate[],
  productOverride?: PricingOverride | null,
  pieces?: PieceLike[] | null,
  withExchange = false,
): {
  breakdown: PriceBreakdown
  weightGrams: number
  goldRatePerGram: number
  metalType: string
  metalColor: string
} | null {
  const pieceKeys = [...new Set(allVariants.map((v) => v.pieceId || '_default'))]
  const multiPiece = pieceKeys.length > 1 && pieceKeys.some((k) => k !== '_default')
  const pieceById = new Map((pieces ?? []).map((p) => [p.id, p]))

  const variantsToPrice: VariantLike[] = multiPiece
    ? pieceKeys.map((key) => {
        const group = allVariants.filter((v) => (v.pieceId || '_default') === key)
        return group.find((x) => sameMetal(x, selected)) ?? null
      }).filter((v): v is VariantLike => Boolean(v))
    : [selected]

  // Multi-piece: every piece must have the selected purity+color (no cross-metal mix).
  if (multiPiece && variantsToPrice.length !== pieceKeys.length) return null

  const parts: PriceBreakdown[] = []
  let weightGrams = 0
  for (const v of variantsToPrice) {
    const rate = rateMap[v.metalType]
    if (!rate) return null
    const weight = Number(v.weightGrams)
    if (!(weight > 0)) return null
    const piece = v.pieceId ? pieceById.get(v.pieceId) : null
    const config = resolvePiecePricingConfig(storePricing, productOverride, piece ?? null)
    const stones = toStoneInputs(stonesForVariant(allStones, v.pieceId))
    parts.push(
      calculatePrice(
        {
          weightGrams: weight,
          makingChargePerGram: Number(v.makingChargePerGram),
          flatMakingCharge: Number(v.flatMakingCharge),
          stoneCharges: Number(v.stoneCharges),
          miscCharges: Number(v.miscCharges),
          certificationCharges: Number(v.certificationCharges ?? 0),
          packagingCharges: Number(v.packagingCharges ?? 0),
          deliveryCharges: Number(v.deliveryCharges ?? 0),
        },
        rate,
        { stones, withExchange, config },
      ),
    )
    weightGrams += weight
  }

  const breakdown = sumPriceBreakdowns(parts)
  const goldRatePerGram = rateMap[selected.metalType]
  if (!goldRatePerGram) return null
  return {
    breakdown,
    weightGrams,
    goldRatePerGram,
    metalType: selected.metalType,
    metalColor: selected.metalColor ?? 'YELLOW',
  }
}

export function toSetOrderItemSnapshot(
  selected: VariantLike,
  allVariants: VariantLike[],
  rateMap: Record<string, number>,
  storePricing: PricingConfig,
  allStones: StoneWithRate[],
  productOverride?: PricingOverride | null,
  pieces?: PieceLike[] | null,
  withExchange = false,
): OrderItemPriceSnapshot | null {
  const built = buildSetPriceBreakdown(
    selected,
    allVariants,
    rateMap,
    storePricing,
    allStones,
    productOverride,
    pieces,
    withExchange,
  )
  if (!built) return null
  return toOrderItemPriceSnapshot(built.breakdown, {
    goldRatePerGram: built.goldRatePerGram,
    weightGrams: built.weightGrams,
    metalType: built.metalType,
    metalColor: built.metalColor,
  })
}

function sumPriceBreakdowns(parts: PriceBreakdown[]): PriceBreakdown {
  const first = parts[0]
  const sum = (pick: (b: PriceBreakdown) => number) => parts.reduce((acc, b) => acc + pick(b), 0)
  return {
    goldValue: sum((b) => b.goldValue),
    goldVA: sum((b) => b.goldVA),
    making: sum((b) => b.making),
    stoneValue: sum((b) => b.stoneValue),
    diamondValue: sum((b) => b.diamondValue),
    otherStoneValue: sum((b) => b.otherStoneValue),
    stoneLines: parts.flatMap((b) => b.stoneLines),
    stoneVA: 0,
    vaTotal: sum((b) => b.vaTotal),
    vaLabel: first.vaLabel,
    miscCharges: sum((b) => b.miscCharges),
    certificationCharges: sum((b) => b.certificationCharges),
    packagingCharges: sum((b) => b.packagingCharges),
    deliveryCharges: sum((b) => b.deliveryCharges),
    taxable: sum((b) => b.taxable),
    gst: sum((b) => b.gst),
    total: sum((b) => b.total),
    withExchange: first.withExchange,
  }
}
