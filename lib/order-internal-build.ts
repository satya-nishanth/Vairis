import type { MetalColor, MetalType, Prisma } from '@prisma/client'
import { z } from 'zod'
import { METAL_COLOR_VALUES, METAL_PURITY_VALUES } from '@/lib/metal'

/** Admin-only physical build on an order line — never shown to customers. */
export type OrderItemInternalBuildStone = {
  typeLabel: string
  diamondRateId?: string | null
  caratWeight: number
  count?: number | null
  label?: string | null
  ratePerCarat?: number | null
}

export type OrderItemInternalBuild = {
  version: 1
  metalType: string
  metalColor: string
  size?: string | null
  weightGrams: number
  makingChargePerGram?: number
  flatMakingCharge?: number
  miscCharges?: number
  stones: OrderItemInternalBuildStone[]
  source: 'catalogue' | 'inventory' | 'manual'
  sourceVariantId?: string | null
  sourceInventoryItemId?: string | null
  capturedAt: string
}

export const internalBuildStoneSchema = z.object({
  typeLabel: z.string().trim().min(1).max(120),
  diamondRateId: z.string().min(1).nullable().optional(),
  caratWeight: z.number().min(0).max(1000),
  count: z.number().int().min(0).max(10000).nullable().optional(),
  label: z.string().trim().max(120).nullable().optional(),
  ratePerCarat: z.number().min(0).max(100000000).nullable().optional(),
})

export const internalBuildSchema = z.object({
  version: z.literal(1),
  metalType: z.enum(METAL_PURITY_VALUES as [string, ...string[]]),
  metalColor: z.enum(METAL_COLOR_VALUES as [string, ...string[]]),
  size: z.string().trim().max(40).nullable().optional(),
  weightGrams: z.number().positive().max(10000),
  makingChargePerGram: z.number().min(0).max(1000000).optional(),
  flatMakingCharge: z.number().min(0).max(10000000).optional(),
  miscCharges: z.number().min(0).max(10000000).optional(),
  stones: z.array(internalBuildStoneSchema).max(40),
  source: z.enum(['catalogue', 'inventory', 'manual']),
  sourceVariantId: z.string().min(1).nullable().optional(),
  sourceInventoryItemId: z.string().min(1).nullable().optional(),
  capturedAt: z.string().min(1),
})

export function parseInternalBuild(raw: unknown): OrderItemInternalBuild | null {
  const parsed = internalBuildSchema.safeParse(raw)
  return parsed.success ? (parsed.data as OrderItemInternalBuild) : null
}

type StoneWithRate = {
  caratWeight: Prisma.Decimal | number | string
  count: number | null
  label: string | null
  ratePerCarat: Prisma.Decimal | number | string | null
  diamondRateId: string
  diamondRate: { label: string }
  pieceId?: string | null
}

type VariantForPrefill = {
  id: string
  metalType: MetalType
  metalColor: MetalColor
  size: string | null
  weightGrams: Prisma.Decimal | number | string
  makingChargePerGram: Prisma.Decimal | number | string
  flatMakingCharge: Prisma.Decimal | number | string
  miscCharges: Prisma.Decimal | number | string
  pieceId: string | null
  product: {
    stones: StoneWithRate[]
  }
}

type InventoryForPrefill = {
  id: string
  weightGrams: Prisma.Decimal | number | string | null
  diamondCarats: Prisma.Decimal | number | string | null
  stoneCarats: Prisma.Decimal | number | string | null
  metalPurity: string | null
} | null

function num(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v == null) return 0
  return Number(v)
}

function stonesForVariant(variant: VariantForPrefill): StoneWithRate[] {
  const all = variant.product.stones
  if (variant.pieceId) {
    const pieceStones = all.filter((s) => s.pieceId === variant.pieceId)
    if (pieceStones.length > 0) return pieceStones
  }
  return all.filter((s) => !s.pieceId)
}

/** Build internalBuild from catalogue variant (+ optional inventory overrides). */
export function prefillInternalBuild(
  variant: VariantForPrefill,
  inventory?: InventoryForPrefill,
): OrderItemInternalBuild {
  const fromInv = Boolean(inventory)
  const stones: OrderItemInternalBuildStone[] = stonesForVariant(variant).map((s) => ({
    typeLabel: s.diamondRate.label,
    diamondRateId: s.diamondRateId,
    caratWeight: num(s.caratWeight),
    count: s.count,
    label: s.label,
    ratePerCarat: s.ratePerCarat != null ? num(s.ratePerCarat) : null,
  }))

  // Inventory may only have aggregate carats — keep catalogue stone lines, override totals when useful.
  if (fromInv && inventory) {
    const dCt = num(inventory.diamondCarats)
    const sCt = num(inventory.stoneCarats)
    if (stones.length === 0 && (dCt > 0 || sCt > 0)) {
      if (dCt > 0) {
        stones.push({
          typeLabel: 'Diamond',
          diamondRateId: null,
          caratWeight: dCt,
          count: null,
          label: null,
          ratePerCarat: null,
        })
      }
      if (sCt > 0) {
        stones.push({
          typeLabel: 'Stone',
          diamondRateId: null,
          caratWeight: sCt,
          count: null,
          label: null,
          ratePerCarat: null,
        })
      }
    } else if (stones.length === 1 && dCt > 0) {
      stones[0] = { ...stones[0]!, caratWeight: dCt }
    }
  }

  let metalType = variant.metalType as string
  if (inventory?.metalPurity) {
    const p = inventory.metalPurity.toUpperCase().replace(/\s+/g, '_')
    if ((METAL_PURITY_VALUES as readonly string[]).includes(p)) metalType = p
    else if (p.includes('22')) metalType = 'GOLD_22K'
    else if (p.includes('18')) metalType = 'GOLD_18K'
    else if (p.includes('14')) metalType = 'GOLD_14K'
    else if (p.includes('9')) metalType = 'GOLD_9K'
  }

  const weightGrams =
    fromInv && inventory?.weightGrams != null && num(inventory.weightGrams) > 0
      ? num(inventory.weightGrams)
      : num(variant.weightGrams)

  return {
    version: 1,
    metalType,
    metalColor: variant.metalColor,
    size: variant.size,
    weightGrams,
    makingChargePerGram: num(variant.makingChargePerGram),
    flatMakingCharge: num(variant.flatMakingCharge),
    miscCharges: num(variant.miscCharges),
    stones,
    source: fromInv ? 'inventory' : 'catalogue',
    sourceVariantId: variant.id,
    sourceInventoryItemId: inventory?.id ?? null,
    capturedAt: new Date().toISOString(),
  }
}

export const orderAttachmentInputSchema = z.object({
  url: z.string().url().max(2000),
  fileName: z.string().trim().min(1).max(260),
  contentType: z.string().trim().max(120).default(''),
})
