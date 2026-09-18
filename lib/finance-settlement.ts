import { roundMoney } from '@/lib/finance'

export type SettlementStatus = 'unpaid' | 'partial' | 'fully_paid' | 'settled' | 'overpaid'

/**
 * Purchase-bill / simple paid-vs-due status (no company-bank gate).
 * Orders use {@link orderPaymentStatus} instead.
 */
export function settlementStatus(expected: number, collected: number): SettlementStatus {
  const due = roundMoney(expected)
  const paid = roundMoney(collected)
  if (due <= 0 && paid <= 0) return 'unpaid'
  if (paid <= 0) return 'unpaid'
  if (paid < due - 0.009) return 'partial'
  if (paid > due + 0.009) return 'overpaid'
  return 'settled'
}

/**
 * Order collection status:
 * - Fully Paid = customer INFLOW covers expected (any wallet)
 * - Settled = COMPANY_BANK holds the amount (INFLOW paid through Company bank, or
 *   TRANSFER into Company bank with the order attached), or manually settled with a note
 *   when funds never reached Company bank
 */
export function orderPaymentStatus(
  expected: number,
  collected: number,
  settledInCompanyBank: number,
  opts?: { manuallySettled?: boolean },
): SettlementStatus {
  const due = roundMoney(expected)
  const paid = roundMoney(collected)
  const inBank = roundMoney(settledInCompanyBank)
  if (paid > due + 0.009) return 'overpaid'
  if (opts?.manuallySettled) return 'settled'
  if (due <= 0 && paid <= 0) return 'unpaid'
  if (paid <= 0) return 'unpaid'
  if (paid < due - 0.009) return 'partial'
  if (inBank >= due - 0.009) return 'settled'
  return 'fully_paid'
}

export const SETTLEMENT_LABEL: Record<SettlementStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  fully_paid: 'Fully Paid',
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
