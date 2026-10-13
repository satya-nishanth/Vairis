import type { MetalColor, MetalType } from '@prisma/client'

/** Gold purity (karat). Drives GoldRate lookup. */
export const METAL_PURITIES = [
  {
    value: 'GOLD_22K' as const,
    label: '22K',
    skuSuffix: 'G22K',
    karat: 22,
    badgeColor: '#fef08a',
    badgeText: '#854d0e',
    badgeBorder: '#fde047',
  },
  {
    value: 'GOLD_18K' as const,
    label: '18K',
    skuSuffix: 'G18K',
    karat: 18,
    badgeColor: '#fef08a',
    badgeText: '#854d0e',
    badgeBorder: '#fde047',
  },
  {
    value: 'GOLD_14K' as const,
    label: '14K',
    skuSuffix: 'G14K',
    karat: 14,
    badgeColor: '#fef9c3',
    badgeText: '#a16207',
    badgeBorder: '#fef08a',
  },
  {
    value: 'GOLD_9K' as const,
    label: '9K',
    skuSuffix: 'G9K',
    karat: 9,
    badgeColor: '#fefce8',
    badgeText: '#a16207',
    badgeBorder: '#fef08a',
  },
] as const

export const METAL_COLORS = [
  {
    value: 'YELLOW' as const,
    label: 'Yellow Gold',
    shortLabel: 'Yellow',
    skuSuffix: 'YG',
    badgeColor: '#fef08a',
    badgeText: '#854d0e',
    badgeBorder: '#fde047',
  },
  {
    value: 'WHITE' as const,
    label: 'White Gold',
    shortLabel: 'White',
    skuSuffix: 'WG',
    badgeColor: '#e5e7eb',
    badgeText: '#374151',
    badgeBorder: '#d1d5db',
  },
  {
    value: 'ROSE' as const,
    label: 'Rose Gold',
    shortLabel: 'Rose',
    skuSuffix: 'RG',
    badgeColor: '#ffe4e6',
    badgeText: '#be123c',
    badgeBorder: '#fecdd3',
  },
] as const

export type MetalPurityValue = (typeof METAL_PURITIES)[number]['value']
export type MetalColorValue = (typeof METAL_COLORS)[number]['value']

export const METAL_PURITY_VALUES = METAL_PURITIES.map((m) => m.value) as [
  MetalPurityValue,
  ...MetalPurityValue[],
]
export const METAL_COLOR_VALUES = METAL_COLORS.map((c) => c.value) as [
  MetalColorValue,
  ...MetalColorValue[],
]

/** Approx ₹/g fallbacks when DB rates missing (admin live estimate). */
export const FALLBACK_GOLD_RATES: Record<MetalPurityValue, number> = {
  GOLD_22K: 6233,
  GOLD_18K: 5100,
  GOLD_14K: 3967,
  GOLD_9K: 2550,
}

export function purityMeta(purity: string) {
  return METAL_PURITIES.find((m) => m.value === purity)
}

export function colorMeta(color: string) {
  return METAL_COLORS.find((c) => c.value === color)
}

/** Customer-facing label, e.g. "18K Rose Gold". */
export function formatMetalLabel(
  purity: string | null | undefined,
  color?: string | null,
): string {
  const p = purityMeta(purity ?? '')
  const c = colorMeta(color ?? 'YELLOW')
  if (!p && !c) return purity || 'Gold'
  if (!p) return c!.label
  if (!c || c.value === 'YELLOW') return `${p.label} Yellow Gold`
  return `${p.label} ${c.label}`
}

/** Short admin badge, e.g. "18K · Rose". */
export function formatMetalShort(
  purity: string | null | undefined,
  color?: string | null,
): string {
  const p = purityMeta(purity ?? '')?.label ?? purity ?? '?'
  const c = colorMeta(color ?? 'YELLOW')
  if (!c || c.value === 'YELLOW') return p
  return `${p} · ${c.shortLabel}`
}

/**
 * Auto SKU: ITEM[-PIECE]-G18K-YG[-SIZE]
 */
export function buildMetalSku(
  itemCode: string,
  metalType: string,
  metalColor: string,
  size?: string | null,
  pieceSlug?: string | null,
): string {
  if (!itemCode) return ''
  const purity = purityMeta(metalType)?.skuSuffix ?? metalType
  const color = colorMeta(metalColor)?.skuSuffix ?? metalColor
  const sizePart = size?.trim()
    ? `-${size.trim().toUpperCase().replace(/\s+/g, '')}`
    : ''
  const piecePart = pieceSlug ? `-${pieceSlug}` : ''
  return `${itemCode.toUpperCase()}${piecePart}-${purity}-${color}${sizePart}`
}

/** GoldRate / rateMap key = purity only. */
export function goldRateKey(metalType: string): MetalType {
  if (metalType === 'GOLD_14K' || metalType === 'GOLD_9K' || metalType === 'GOLD_22K') {
    return metalType
  }
  return 'GOLD_18K'
}

/** PLP filter facet strings derived from a variant. */
export function metalFilterLabels(
  metalType: string,
  metalColor: string,
): string[] {
  const labels: string[] = []
  const c = colorMeta(metalColor)
  if (c) labels.push(c.label)
  const p = purityMeta(metalType)
  if (p) labels.push(`${p.label} Gold`)
  return labels
}

export function isMetalPurity(v: string): v is MetalPurityValue {
  return METAL_PURITY_VALUES.includes(v as MetalPurityValue)
}

export function isMetalColor(v: string): v is MetalColorValue {
  return METAL_COLOR_VALUES.includes(v as MetalColorValue)
}

export function normalizeMetalColor(
  color: string | null | undefined,
): MetalColor {
  if (color && isMetalColor(color)) return color
  return 'YELLOW'
}
