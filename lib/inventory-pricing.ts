import type { MetalType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculatePrice, type PricingConfig } from '@/lib/pricing'
import { getPricingConfig, toStoneInputs, type StoneWithRate } from '@/lib/pricing-data'

export type VariantForPricing = {
  weightGrams: { toString(): string } | number | string
  makingChargePerGram: { toString(): string } | number | string
  flatMakingCharge: { toString(): string } | number | string
  stoneCharges: { toString(): string } | number | string
  miscCharges: { toString(): string } | number | string
  metalType: MetalType
  product: { stones: StoneWithRate[] }
}

/** Live PDP-style unit price (without exchange) for a catalogue variant. */
export function computeVariantLiveUnitPrice(
  variant: VariantForPricing,
  ratePerGram: number | undefined,
  pricingConfig: PricingConfig,
  withExchange = false,
): number | null {
  if (!ratePerGram) return null
  const total = calculatePrice(
    {
      weightGrams: String(variant.weightGrams),
      makingChargePerGram: String(variant.makingChargePerGram),
      flatMakingCharge: String(variant.flatMakingCharge),
      stoneCharges: String(variant.stoneCharges),
      miscCharges: String(variant.miscCharges),
    },
    ratePerGram,
    { stones: toStoneInputs(variant.product.stones), withExchange, config: pricingConfig },
  ).total
  return Math.round(total)
}

export async function getLiveUnitPricesByVariantId(
  variantIds: string[],
): Promise<Record<string, number>> {
  const unique = [...new Set(variantIds.filter(Boolean))]
  if (unique.length === 0) return {}

  const [variants, goldRates, pricingConfig] = await Promise.all([
    prisma.productVariant.findMany({
      where: { id: { in: unique } },
      include: {
        product: {
          include: { stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } } },
        },
      },
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
  ])

  const rateMap = Object.fromEntries(
    goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]),
  ) as Record<MetalType, number>

  const out: Record<string, number> = {}
  for (const v of variants) {
    const price = computeVariantLiveUnitPrice(v, rateMap[v.metalType], pricingConfig)
    if (price != null) out[v.id] = price
  }
  return out
}

export function effectiveInventoryUnitPrice(
  unitPrice: number | null,
  variantId: string | null,
  liveByVariantId: Record<string, number>,
): number | null {
  if (unitPrice != null) return unitPrice
  if (variantId && liveByVariantId[variantId] != null) return liveByVariantId[variantId]
  return null
}
