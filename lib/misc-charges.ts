/**
 * Labeled misc / hallmark / delivery-style charge lines.
 * Sum feeds pricing as miscCharges; labels show on invoices.
 */

export type MiscChargeLine = {
  label: string
  amount: number
}

export const DEFAULT_MISC_LABEL = 'Hallmark'

export function sumMiscChargeLines(lines: MiscChargeLine[] | undefined | null): number {
  if (!lines?.length) return 0
  return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
}

/** Drop blank rows; keep zero amounts only when a label is set (admin may clear amount temporarily). */
export function normalizeMiscChargeLines(lines: MiscChargeLine[] | undefined | null): MiscChargeLine[] {
  if (!lines?.length) return []
  return lines
    .map((l) => ({
      label: (l.label ?? '').trim(),
      amount: Math.max(0, Number(l.amount) || 0),
    }))
    .filter((l) => l.label !== '' || l.amount > 0)
}

export function miscChargeLinesFromFlat(
  amount: number,
  label: string = DEFAULT_MISC_LABEL,
): MiscChargeLine[] {
  const n = Number(amount) || 0
  if (n <= 0) return []
  return [{ label: label.trim() || DEFAULT_MISC_LABEL, amount: n }]
}

export function parseMiscChargeLines(raw: unknown): MiscChargeLine[] {
  if (!Array.isArray(raw)) return []
  const out: MiscChargeLine[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const label = typeof o.label === 'string' ? o.label.trim() : ''
    const amount = Number(o.amount)
    if (!label && !(amount > 0)) continue
    if (!Number.isFinite(amount) || amount < 0) continue
    out.push({ label: label || DEFAULT_MISC_LABEL, amount })
  }
  return out
}

/** Prefer JSON lines; fall back to flat miscCharges as a single Hallmark row. */
export function resolveMiscChargeLines(
  linesRaw: unknown,
  flatAmount: number,
  fallbackLabel: string = DEFAULT_MISC_LABEL,
): MiscChargeLine[] {
  const parsed = normalizeMiscChargeLines(parseMiscChargeLines(linesRaw))
  if (parsed.length > 0) return parsed
  return miscChargeLinesFromFlat(flatAmount, fallbackLabel)
}
