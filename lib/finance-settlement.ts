import { roundMoney } from '@/lib/finance'

export type SettlementStatus = 'unpaid' | 'partial' | 'settled' | 'overpaid'

export function settlementStatus(expected: number, collected: number): SettlementStatus {
  const due = roundMoney(expected)
  const paid = roundMoney(collected)
  if (due <= 0 && paid <= 0) return 'unpaid'
  if (paid <= 0) return 'unpaid'
  if (paid < due - 0.009) return 'partial'
  if (paid > due + 0.009) return 'overpaid'
  return 'settled'
}

export const SETTLEMENT_LABEL: Record<SettlementStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  settled: 'Settled',
  overpaid: 'Overpaid',
}

/** Expected collect for an order: sheet SP when sheet exists, else grandTotal. */
export function orderExpectedAmount(opts: {
  grandTotal: number
  sheetSelling: number | null | undefined
}): number {
  if (opts.sheetSelling != null && Number.isFinite(opts.sheetSelling) && opts.sheetSelling > 0) {
    return roundMoney(opts.sheetSelling)
  }
  return roundMoney(opts.grandTotal)
}
