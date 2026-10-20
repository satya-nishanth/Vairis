import { prisma } from '@/lib/prisma'
import {
  DEFAULT_PRICING_CONFIG,
  resolvePricingConfig,
  type PricingConfig,
  type PricingOverride,
  type StoneInput,
} from '@/lib/pricing'
import type { ProductStone, DiamondRate } from '@prisma/client'

/**
 * Server-side loaders for pricing inputs: the PricingSettings singleton and
 * per-product stone rows (with their DiamondRate). Falls back to defaults so
 * pricing never hard-fails if the settings row is missing.
 */

export type StoneWithRate = ProductStone & { diamondRate: DiamondRate }
export type { PricingOverride }
export { resolvePricingConfig }

export async function getPricingConfig(): Promise<PricingConfig> {
  const row = await prisma.pricingSettings.findUnique({ where: { id: 1 } })
  if (!row) return DEFAULT_PRICING_CONFIG
  return {
    vaGoldPct: Number(row.vaGoldPct),
    vaStonePct: Number(row.vaStonePct),
    vaLabel: row.vaLabel,
    defaultCertificationCharges: Number(row.defaultCertificationCharges ?? 0),
    defaultPackagingCharges: Number(row.defaultPackagingCharges ?? 0),
    defaultDeliveryCharges: Number(row.defaultDeliveryCharges ?? 0),
    certificationLabel: row.certificationLabel || DEFAULT_PRICING_CONFIG.certificationLabel,
    packagingLabel: row.packagingLabel || DEFAULT_PRICING_CONFIG.packagingLabel,
    deliveryLabel: row.deliveryLabel || DEFAULT_PRICING_CONFIG.deliveryLabel,
  }
}

/** Storefront-wide default for whether computed prices are shown at all. */
export async function getShowPricesGlobal(): Promise<boolean> {
  const row = await prisma.pricingSettings.findUnique({ where: { id: 1 }, select: { showPricesGlobal: true } })
  return row?.showPricesGlobal ?? true
}

/** Effective show/hide decision: per-product override wins, else the global default. */
export function resolvePriceVisibility(
  priceVisibility: 'INHERIT' | 'SHOW' | 'HIDE',
  showPricesGlobal: boolean,
): boolean {
  if (priceVisibility === 'SHOW') return true
  if (priceVisibility === 'HIDE') return false
  return showPricesGlobal
}

export function toStoneInputs(stones: StoneWithRate[]): StoneInput[] {
  return stones.map((s) => ({
    caratWeight: Number(s.caratWeight),
    ratePerCarat:
      s.ratePerCarat != null ? Number(s.ratePerCarat) : Number(s.diamondRate.ratePerCarat),
    ratePerCaratExchange:
      s.ratePerCaratExchange != null
        ? Number(s.ratePerCaratExchange)
        : Number(s.diamondRate.ratePerCaratExchange),
    typeLabel: s.diamondRate.label,
  }))
}

/** Stones for a variant: prefer same piece; else all product stones (legacy). */
export function stonesForVariant(
  stones: StoneWithRate[],
  pieceId: string | null | undefined,
): StoneWithRate[] {
  if (!pieceId) return stones
  // Piece-scoped variant: only that piece's stones (never fall back to the
  // whole product — that double-counts diamonds on multi-piece sets).
  return stones.filter((s) => s.pieceId === pieceId)
}

/** Piece VA overrides product VA, which overrides store settings. */
export function resolvePiecePricingConfig(
  store: PricingConfig,
  product?: PricingOverride | null,
  piece?: PricingOverride | null,
): PricingConfig {
  return resolvePricingConfig(store, {
    vaGoldPct: piece?.vaGoldPct ?? product?.vaGoldPct ?? null,
    vaLabel: piece?.vaLabel ?? product?.vaLabel ?? null,
  })
}

/** Serializable stone shape for client components (PDP). */
export type StoneView = {
  id: string
  typeLabel: string
  caratWeight: number
  count: number | null
  label: string | null
  ratePerCarat: number
  ratePerCaratExchange: number
}

export function toStoneViews(stones: StoneWithRate[]): StoneView[] {
  return stones.map((s) => ({
    id: s.id,
    typeLabel: s.diamondRate.label,
    caratWeight: Number(s.caratWeight),
    count: s.count,
    label: s.label,
    ratePerCarat:
      s.ratePerCarat != null ? Number(s.ratePerCarat) : Number(s.diamondRate.ratePerCarat),
    ratePerCaratExchange:
      s.ratePerCaratExchange != null
        ? Number(s.ratePerCaratExchange)
        : Number(s.diamondRate.ratePerCaratExchange),
  }))
}
