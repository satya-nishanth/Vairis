import { prisma } from '@/lib/prisma'
import { DEFAULT_PRICING_CONFIG, type PricingConfig, type StoneInput } from '@/lib/pricing'
import type { ProductStone, DiamondRate } from '@prisma/client'

/**
 * Server-side loaders for pricing inputs: the PricingSettings singleton and
 * per-product stone rows (with their DiamondRate). Falls back to defaults so
 * pricing never hard-fails if the settings row is missing.
 */

export type StoneWithRate = ProductStone & { diamondRate: DiamondRate }

export async function getPricingConfig(): Promise<PricingConfig> {
  const row = await prisma.pricingSettings.findUnique({ where: { id: 1 } })
  if (!row) return DEFAULT_PRICING_CONFIG
  return {
    vaGoldPct: Number(row.vaGoldPct),
    vaStonePct: Number(row.vaStonePct),
    vaLabel: row.vaLabel,
  }
}

export function toStoneInputs(stones: StoneWithRate[]): StoneInput[] {
  return stones.map((s) => ({
    caratWeight: Number(s.caratWeight),
    ratePerCarat: Number(s.diamondRate.ratePerCarat),
    ratePerCaratExchange: Number(s.diamondRate.ratePerCaratExchange),
    typeLabel: s.diamondRate.label,
  }))
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
    ratePerCarat: Number(s.diamondRate.ratePerCarat),
    ratePerCaratExchange: Number(s.diamondRate.ratePerCaratExchange),
  }))
}
