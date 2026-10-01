import type { MetalType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { type PricingConfig } from '@/lib/pricing'
import { getPricingConfig, type StoneWithRate } from '@/lib/pricing-data'
import { priceVariantUnit } from '@/lib/product-piece-pricing'

export type VariantForPricing = {
  id?: string
  pieceId?: string | null
  weightGrams: { toString(): string } | number | string
  makingChargePerGram: { toString(): string } | number | string
  flatMakingCharge: { toString(): string } | number | string
  stoneCharges: { toString(): string } | number | string
  miscCharges: { toString(): string } | number | string
  metalType: MetalType
  product: {
    stones: StoneWithRate[]
    vaGoldPct?: number | string | { toString(): string } | null
    vaLabel?: string | null
  }
  piece?: {
    id: string
    vaGoldPct?: number | string | { toString(): string } | null
    vaLabel?: string | null
  } | null
}

/** Live PDP-style unit price (without exchange) for a catalogue variant. */
export function computeVariantLiveUnitPrice(
  variant: VariantForPricing,
  ratePerGram: number | undefined,
  pricingConfig: PricingConfig,
  withExchange = false,
): number | null {
  return priceVariantUnit(
    {
      id: variant.id ?? '',
      pieceId: variant.pieceId ?? variant.piece?.id ?? null,
      metalType: variant.metalType,
      weightGrams: variant.weightGrams as never,
      makingChargePerGram: variant.makingChargePerGram as never,
      flatMakingCharge: variant.flatMakingCharge as never,
      stoneCharges: variant.stoneCharges as never,
      miscCharges: variant.miscCharges as never,
    },
    ratePerGram,
    pricingConfig,
    variant.product.stones,
    variant.product,
    variant.piece ?? null,
    withExchange,
  )
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
        piece: true,
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

export function effectiveInventorySoldPrice(
  soldPrice: number | null,
  variantId: string | null,
  liveByVariantId: Record<string, number>,
): number | null {
  if (soldPrice != null) return soldPrice
  if (variantId && liveByVariantId[variantId] != null) return liveByVariantId[variantId]
  return null
}

/** Header KPI unit price: potential → live catalogue → purchase. */
export function effectiveInventoryHeaderPrice(
  potentialPrice: number | null,
  purchasePrice: number | null,
  variantId: string | null,
  liveByVariantId: Record<string, number>,
): number | null {
  if (potentialPrice != null) return potentialPrice
  if (variantId && liveByVariantId[variantId] != null) return liveByVariantId[variantId]
  if (purchasePrice != null) return purchasePrice
  return null
}
