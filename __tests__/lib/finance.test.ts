import { istMonthUtcRange, istYearMonth, orderProfit, sheetTotals, summarizeFinance } from '@/lib/finance'

describe('sheetTotals / orderProfit', () => {
  it('sums line cost and selling prices', () => {
    expect(
      sheetTotals([
        { kind: 'GOLD', costPrice: 8000, sellingPrice: 12000 },
        { kind: 'DIAMONDS', costPrice: 3000, sellingPrice: 6000 },
      ]),
    ).toEqual({ cost: 11000, selling: 18000, profit: 7000 })
  })

  it('allows negative profit', () => {
    expect(orderProfit(10000, 14500)).toBe(-4500)
  })
})

describe('IST month range', () => {
  it('places 18 Aug 2026 20:00 IST in August', () => {
    // 2026-08-18 20:00 IST = 2026-08-18 14:30 UTC
    const d = new Date('2026-08-18T14:30:00.000Z')
    expect(istYearMonth(d)).toEqual({ year: 2026, month: 8 })
  })

  it('places 31 Jul 2026 23:30 IST in July, not August', () => {
    // 2026-07-31 23:30 IST = 2026-07-31 18:00 UTC
    const d = new Date('2026-07-31T18:00:00.000Z')
    expect(istYearMonth(d)).toEqual({ year: 2026, month: 7 })
  })

  it('August 2026 UTC range starts at 31 Jul 18:30 UTC', () => {
    const { start, end } = istMonthUtcRange(2026, 8)
    expect(start.toISOString()).toBe('2026-07-31T18:30:00.000Z')
    expect(end.toISOString()).toBe('2026-08-31T18:30:00.000Z')
  })
})

describe('summarizeFinance', () => {
  const expenses = [
    {
      date: new Date('2026-08-10T00:00:00+05:30'),
      amount: 2000,
      paidThrough: 'PERSONAL_FUNDS' as const,
      contributor: 'ANIL' as const,
    },
    {
      date: new Date('2026-08-12T00:00:00+05:30'),
      amount: 500,
      paidThrough: 'VAIRIS_BANK' as const,
      contributor: null,
    },
    {
      date: new Date('2026-07-01T00:00:00+05:30'),
      amount: 9999,
      paidThrough: 'PERSONAL_FUNDS' as const,
      contributor: 'SURYA' as const,
    },
  ]
  const sheets = [
    {
      orderCreatedAt: new Date('2026-08-05T10:00:00+05:30'),
      cost: 10000,
      sellingPrice: 15000,
      customerPaidTo: 'ANIL' as const,
    },
    {
      orderCreatedAt: new Date('2026-08-20T10:00:00+05:30'),
      cost: 1000,
      sellingPrice: 3000,
      customerPaidTo: 'VAIRIS_BANK' as const,
    },
  ]

  it('all-time includes every row; contribution and receipts stay separate', () => {
    const s = summarizeFinance(expenses, sheets)
    expect(s.income).toBe(18000)
    expect(s.orderCost).toBe(11000)
    expect(s.generalExpenses).toBe(12499)
    // profits 5000 + 2000 = 7000; minus expenses 12499
    expect(s.profit).toBe(7000 - 12499)
    expect(s.byPerson.find((p) => p.person === 'ANIL')).toEqual({
      person: 'ANIL',
      contribution: 2000,
      receiptsHeld: 15000,
    })
    expect(s.byPerson.find((p) => p.person === 'SURYA')?.contribution).toBe(9999)
    expect(s.byPerson.find((p) => p.person === 'VASU')).toEqual({
      person: 'VASU',
      contribution: 0,
      receiptsHeld: 0,
    })
  })

  it('month filter uses IST range and excludes other months', () => {
    const { start, end } = istMonthUtcRange(2026, 8)
    const s = summarizeFinance(expenses, sheets, { start, end })
    expect(s.generalExpenses).toBe(2500)
    expect(s.income).toBe(18000)
    expect(s.byPerson.find((p) => p.person === 'SURYA')?.contribution).toBe(0)
    expect(s.byPerson.find((p) => p.person === 'ANIL')?.contribution).toBe(2000)
  })
})
