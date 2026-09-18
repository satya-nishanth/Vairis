import {
  orderPaymentStatus,
  settlementStatus,
  SETTLEMENT_LABEL,
} from '@/lib/finance-settlement'

describe('settlementStatus (purchase bills)', () => {
  it('returns settled when paid equals due', () => {
    expect(settlementStatus(10_000, 10_000)).toBe('settled')
    expect(settlementStatus(10_000, 0)).toBe('unpaid')
    expect(settlementStatus(10_000, 4_000)).toBe('partial')
    expect(settlementStatus(10_000, 11_000)).toBe('overpaid')
  })
})

describe('orderPaymentStatus', () => {
  it('is fully_paid when customer covered due but company bank has not', () => {
    expect(orderPaymentStatus(100_000, 100_000, 0)).toBe('fully_paid')
    expect(orderPaymentStatus(100_000, 100_000, 40_000)).toBe('fully_paid')
  })

  it('is settled when company bank holds the full amount', () => {
    expect(orderPaymentStatus(100_000, 100_000, 100_000)).toBe('settled')
    // Direct receipt into company bank
    expect(orderPaymentStatus(50_300, 50_300, 50_300)).toBe('settled')
  })

  it('stays partial until customer inflow covers due', () => {
    expect(orderPaymentStatus(100_000, 40_000, 40_000)).toBe('partial')
    expect(orderPaymentStatus(100_000, 0, 0)).toBe('unpaid')
  })

  it('is settled when manually marked settled (even if not fully paid / not in company bank)', () => {
    expect(orderPaymentStatus(100_000, 100_000, 0, { manuallySettled: true })).toBe('settled')
    expect(orderPaymentStatus(100_000, 0, 0, { manuallySettled: true })).toBe('settled')
    expect(orderPaymentStatus(100_000, 40_000, 0, { manuallySettled: true })).toBe('settled')
  })

  it('still prefers overpaid when customer inflow exceeds due', () => {
    expect(orderPaymentStatus(100_000, 110_000, 0, { manuallySettled: true })).toBe('overpaid')
  })

  it('prefers overpaid when customer inflow exceeds due', () => {
    expect(orderPaymentStatus(100_000, 110_000, 0)).toBe('overpaid')
    expect(orderPaymentStatus(100_000, 110_000, 110_000)).toBe('overpaid')
  })

  it('labels fully paid', () => {
    expect(SETTLEMENT_LABEL.fully_paid).toBe('Fully Paid')
  })
})
