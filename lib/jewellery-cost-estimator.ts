/**
 * Jewellery cost estimator (admin tool).
 * Separate from retail `lib/pricing.ts` — uses 24K→purity rate + ₹100/g uplift,
 * wastage on gold cost, GST on (gold+diamond+wastage+making), then flat additional.
 */

export type GoldKarat = 24 | 22 | 18 | 14 | 9

export const GOLD_PURITIES: Record<GoldKarat, { label: string; multiplier: number }> = {
  24: { label: '24K', multiplier: 24 / 24 },
  22: { label: '22K', multiplier: 22 / 24 },
  18: { label: '18K', multiplier: 18 / 24 },
  14: { label: '14K', multiplier: 14 / 24 },
  9: { label: '9K', multiplier: 9 / 24 },
}

export type DiamondSetInput = {
  id: number
  name: string
  carats: string
  costPerCarat: string
}

export type EstimatorResults = {
  goldCost: number
  diamondCost: number
  wastageCost: number
  makingCost: number
  totalBeforeGst: number
  additionalCost: number
  finalTotal: number
  effectiveGoldRate: number
  gstAmount: number
  totalWithGst: number
}

export function stripCommas(value: string | null | undefined): string {
  // Keep digits + one dot only — strips ASCII/Unicode commas, spaces, currency, etc.
  // Critical on mobile where locale keyboards / toLocaleString can insert non-ASCII separators.
  return String(value ?? '')
    .replace(/[^\d.]/g, '')
    .replace(/(\..*)\./g, '$1')
}

export function parseNum(value: string | number | null | undefined): number | null {
  if (value === '' || value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const raw = stripCommas(String(value))
  if (raw === '' || raw === '.') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function formatNumber(
  amount: number,
  { minFrac = 0, maxFrac = 2 }: { minFrac?: number; maxFrac?: number } = {},
): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  })
}

export function formatCurrency(amount: number): string {
  return `₹${formatNumber(amount, { minFrac: 2, maxFrac: 2 })}`
}

export function filterDecimalInput(value: string): string {
  // Mobile EU keyboards often emit "," as the decimal separator.
  let s = String(value ?? '')
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.')
  }
  return s.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
}

/**
 * Live en-IN grouping while typing (keeps trailing "." / decimals).
 * "15056" → "15,056", "0.50" → "0.50"
 */
export function formatWhileTyping(value: string): string {
  const filtered = filterDecimalInput(value)
  if (filtered === '' || filtered === '.') return filtered
  const hasDot = filtered.includes('.')
  const [intRaw, decRaw] = filtered.split('.')
  if (intRaw === '') {
    return hasDot ? `0.${decRaw ?? ''}` : filtered
  }
  const intNum = Number(intRaw)
  if (!Number.isFinite(intNum)) return filtered
  const intFormatted = intNum.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
    useGrouping: true,
  })
  if (!hasDot) return intFormatted
  return `${intFormatted}.${decRaw ?? ''}`
}

export function decimalPlaces(value: string): number {
  const raw = stripCommas(value)
  if (!raw.includes('.')) return 0
  return (raw.split('.')[1] || '').length
}

export function formatInputValue(value: string): string {
  if (value === '' || value == null) return ''
  const n = parseNum(value)
  if (n === null) return stripCommas(value)
  const dec = decimalPlaces(value)
  return formatNumber(n, { minFrac: dec, maxFrac: dec })
}

export function isValidDecimal(value: string): boolean {
  if (value === '' || value == null) return true
  const raw = stripCommas(value)
  if (raw === '' || raw === '.') return false
  const n = parseNum(raw)
  return /^\d*\.?\d*$/.test(raw) && n !== null && n >= 0
}

export function isValidPercentage(value: string): boolean {
  if (value === '' || value == null) return true
  const n = parseNum(value)
  return n !== null && n >= 0 && n <= 100
}

export function calculateEffectiveGoldRate(
  goldRateToday: number,
  karat: GoldKarat,
  hasGoldRate: boolean,
): number {
  if (!hasGoldRate) return 0
  return goldRateToday * GOLD_PURITIES[karat].multiplier + 100
}

export function calculateGoldCost(
  goldRateToday: number,
  goldWeight: number,
  karat: GoldKarat,
  hasGold: boolean,
): number {
  if (!hasGold) return 0
  return calculateEffectiveGoldRate(goldRateToday, karat, true) * goldWeight
}

export function diamondSetLineCost(set: { carats: string; costPerCarat: string }): number {
  const carats = parseNum(set.carats)
  const rate = parseNum(set.costPerCarat)
  if (carats === null || rate === null) return 0
  return carats * rate
}

export function buildEstimatorResults(input: {
  goldCost: number
  diamondCost: number
  goldWeight: number | null
  goldWeightText: string
  wastagePct: number | null
  gstPct: number | null
  makingPerGram: number | null
  additionalFlat: number | null
  hasGold: boolean
  effectiveGoldRate: number
}): EstimatorResults {
  const {
    goldCost,
    diamondCost,
    goldWeight,
    goldWeightText,
    wastagePct,
    gstPct,
    makingPerGram,
    additionalFlat,
    hasGold,
    effectiveGoldRate,
  } = input

  const wastageCost = hasGold && wastagePct !== null ? goldCost * (wastagePct / 100) : 0
  const makingCost =
    goldWeight !== null && makingPerGram !== null && goldWeightText !== ''
      ? goldWeight * makingPerGram
      : 0
  const totalBeforeGst = goldCost + diamondCost + wastageCost + makingCost
  const gstAmount = gstPct !== null ? (totalBeforeGst * gstPct) / 100 : 0
  const totalWithGst = totalBeforeGst + gstAmount
  const additionalCost = additionalFlat !== null ? additionalFlat : 0
  const finalTotal = totalWithGst + additionalCost

  return {
    goldCost,
    diamondCost,
    wastageCost,
    makingCost,
    totalBeforeGst,
    additionalCost,
    finalTotal,
    effectiveGoldRate: effectiveGoldRate || 0,
    gstAmount,
    totalWithGst,
  }
}

export function computeStandardEstimate(input: {
  goldRate: string
  diamondRate: string
  weight: string
  carats: string
  karat: GoldKarat
  wastage: string
  gst: string
  making: string
  additional: string
}): EstimatorResults {
  const goldRateN = parseNum(input.goldRate)
  const weightN = parseNum(input.weight)
  const diamondRateN = parseNum(input.diamondRate)
  const caratsN = parseNum(input.carats)
  const hasGold = input.goldRate !== '' && goldRateN !== null && input.weight !== '' && weightN !== null
  const hasDiamond =
    input.diamondRate !== '' && diamondRateN !== null && input.carats !== '' && caratsN !== null
  const hasGoldRate = input.goldRate !== '' && goldRateN !== null

  const effectiveGoldRate = calculateEffectiveGoldRate(goldRateN ?? 0, input.karat, hasGoldRate)
  const goldCost = calculateGoldCost(goldRateN ?? 0, weightN ?? 0, input.karat, hasGold)
  const diamondCost = hasDiamond ? (diamondRateN as number) * (caratsN as number) : 0

  return buildEstimatorResults({
    goldCost,
    diamondCost,
    goldWeight: weightN,
    goldWeightText: input.weight,
    wastagePct: parseNum(input.wastage),
    gstPct: parseNum(input.gst),
    makingPerGram: parseNum(input.making),
    additionalFlat: input.additional !== '' ? parseNum(input.additional) : null,
    hasGold,
    effectiveGoldRate,
  })
}

export function computeComplexEstimate(input: {
  goldRate: string
  weight: string
  karat: GoldKarat
  wastage: string
  gst: string
  making: string
  additional: string
  diamondSets: DiamondSetInput[]
}): EstimatorResults {
  const goldRateN = parseNum(input.goldRate)
  const weightN = parseNum(input.weight)
  const hasGold = input.goldRate !== '' && goldRateN !== null && input.weight !== '' && weightN !== null
  const hasGoldRate = input.goldRate !== '' && goldRateN !== null
  const effectiveGoldRate = calculateEffectiveGoldRate(goldRateN ?? 0, input.karat, hasGoldRate)
  const goldCost = calculateGoldCost(goldRateN ?? 0, weightN ?? 0, input.karat, hasGold)
  const diamondCost = input.diamondSets.reduce((sum, s) => sum + diamondSetLineCost(s), 0)

  return buildEstimatorResults({
    goldCost,
    diamondCost,
    goldWeight: weightN,
    goldWeightText: input.weight,
    wastagePct: parseNum(input.wastage),
    gstPct: parseNum(input.gst),
    makingPerGram: parseNum(input.making),
    additionalFlat: input.additional !== '' ? parseNum(input.additional) : null,
    hasGold,
    effectiveGoldRate,
  })
}

export function diamondDisplayName(set: { name: string }, index: number): string {
  const name = (set.name || '').trim()
  return name || `Diamond ${index}`
}
