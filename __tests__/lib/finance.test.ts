import {
  istMonthUtcRange,
  istQuarterUtcRange,
  istYearMonth,
  istStartOfDayUtc,
  orderProfit,
  sheetTotals,
  isPendingOrderSheet,
  isOrderSheetComplete,
  summarizeFinance,
  summarizeTransactionFlows,
  summarizeDashboardKpis,
  findSheetInflowMismatches,
  summarizeTransactionReport,
  toFinanceCategoryDirection,
  type FinanceTransactionDirection,
} from '@/lib/finance'

describe('toFinanceCategoryDirection', () => {
  it('maps INFLOW and defaults unknown values to OUTFLOW', () => {
    expect(toFinanceCategoryDirection('INFLOW')).toBe('INFLOW')
    expect(toFinanceCategoryDirection('OUTFLOW')).toBe('OUTFLOW')
    expect(toFinanceCategoryDirection('TRANSFER')).toBe('OUTFLOW')
  })
})

describe('sheetTotals / orderProfit', () => {
  it('sums line cost and selling prices', () => {
    expect(
      sheetTotals([
        { kind: 'GOLD', costPrice: 8000, sellingPrice: 12000 },
        { kind: 'DIAMONDS', costPrice: 3000, sellingPrice: 6000 },
      ]),
    ).toEqual({
      cost: 11000,
      selling: 18000,
      sellingRaw: 18000,
      roundOff: 0,
      profit: 7000,
      roundOffEnabled: false,
    })
  })

  it('rounds selling to nearest rupee when enabled', () => {
    expect(
      sheetTotals(
        [
          { kind: 'GOLD', costPrice: 8000, sellingPrice: 12000.4 },
          { kind: 'GST', costPrice: 0, sellingPrice: 360.26 },
        ],
        { roundOffEnabled: true },
      ),
    ).toEqual({
      cost: 8000,
      selling: 12361,
      sellingRaw: 12360.66,
      roundOff: 0.34,
      profit: 4361,
      roundOffEnabled: true,
    })
  })

  it('allows negative profit', () => {
    expect(orderProfit(10000, 14500)).toBe(-4500)
  })
})

describe('isOrderSheetComplete / isPendingOrderSheet', () => {
  it('is incomplete with no sheet', () => {
    expect(isOrderSheetComplete(null)).toBe(false)
    expect(isPendingOrderSheet(null)).toBe(true)
  })

  it('is incomplete when a selling line has zero purchase', () => {
    expect(
      isOrderSheetComplete([
        { costPrice: 0, sellingPrice: 21516 },
        { costPrice: 0, sellingPrice: 1100 },
      ]),
    ).toBe(false)
  })

  it('is complete when every selling line has purchase', () => {
    expect(
      isOrderSheetComplete([
        { costPrice: 18000, sellingPrice: 21516 },
        { costPrice: 0, sellingPrice: 0 },
        { costPrice: 800, sellingPrice: 1100 },
      ]),
    ).toBe(true)
    expect(
      isPendingOrderSheet([
        { costPrice: 18000, sellingPrice: 21516 },
        { costPrice: 800, sellingPrice: 1100 },
      ]),
    ).toBe(false)
  })

  it('is incomplete when only some selling lines have purchase', () => {
    expect(
      isOrderSheetComplete([
        { costPrice: 18000, sellingPrice: 21516 },
        { costPrice: 0, sellingPrice: 1100 },
      ]),
    ).toBe(false)
  })

  it('treats empty sheet / zero-selling lines as complete', () => {
    expect(isOrderSheetComplete([])).toBe(true)
    expect(isOrderSheetComplete([{ costPrice: 0, sellingPrice: 0 }])).toBe(true)
  })
})

describe('IST month range', () => {
  it('places 18 Aug 2026 20:00 IST in August', () => {
    const d = new Date('2026-08-18T14:30:00.000Z')
    expect(istYearMonth(d)).toEqual({ year: 2026, month: 8 })
  })

  it('places 31 Jul 2026 23:30 IST in July, not August', () => {
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
  const accounts = [
    { id: 'fa_anil', name: 'Anil', type: 'PARTNER' as const },
    { id: 'fa_surya', name: 'Surya', type: 'PARTNER' as const },
    { id: 'fa_vasu', name: 'Vasu', type: 'PARTNER' as const },
    { id: 'fa_bank', name: 'Vairis Bank', type: 'COMPANY_BANK' as const },
  ]
  const expenses = [
    {
      date: new Date('2026-08-10T00:00:00+05:30'),
      amount: 2000,
      paidThrough: 'PERSONAL_FUNDS' as const,
      accountId: 'fa_anil',
    },
    {
      date: new Date('2026-08-12T00:00:00+05:30'),
      amount: 500,
      paidThrough: 'VAIRIS_BANK' as const,
      accountId: null,
    },
    {
      date: new Date('2026-07-01T00:00:00+05:30'),
      amount: 9999,
      paidThrough: 'PERSONAL_FUNDS' as const,
      accountId: 'fa_surya',
    },
  ]
  const sheets = [
    {
      orderCreatedAt: new Date('2026-08-05T10:00:00+05:30'),
      cost: 10000,
      sellingPrice: 15000,
      paidToAccountId: 'fa_anil',
    },
    {
      orderCreatedAt: new Date('2026-08-20T10:00:00+05:30'),
      cost: 1000,
      sellingPrice: 3000,
      paidToAccountId: 'fa_bank',
    },
  ]

  it('all-time includes every row; contribution and receipts stay separate', () => {
    const s = summarizeFinance(expenses, sheets, accounts)
    expect(s.income).toBe(18000)
    expect(s.orderCost).toBe(11000)
    expect(s.generalExpenses).toBe(12499)
    expect(s.profit).toBe(7000 - 12499)
    expect(s.byAccount.find((p) => p.accountId === 'fa_anil')).toEqual({
      accountId: 'fa_anil',
      accountName: 'Anil',
      contribution: 2000,
      receiptsHeld: 15000,
    })
    expect(s.byAccount.find((p) => p.accountId === 'fa_surya')?.contribution).toBe(9999)
    expect(s.byAccount.find((p) => p.accountId === 'fa_vasu')).toEqual({
      accountId: 'fa_vasu',
      accountName: 'Vasu',
      contribution: 0,
      receiptsHeld: 0,
    })
  })

  it('month filter uses IST range and excludes other months', () => {
    const { start, end } = istMonthUtcRange(2026, 8)
    const s = summarizeFinance(expenses, sheets, accounts, { start, end })
    expect(s.generalExpenses).toBe(2500)
    expect(s.income).toBe(18000)
    expect(s.byAccount.find((p) => p.accountId === 'fa_surya')?.contribution).toBe(0)
    expect(s.byAccount.find((p) => p.accountId === 'fa_anil')?.contribution).toBe(2000)
  })
})

describe('summarizeTransactionFlows', () => {
  const accounts = [
    { id: 'fa_anil', name: 'Anil', type: 'PARTNER' as const },
    { id: 'fa_bank', name: 'Vairis Bank', type: 'COMPANY_BANK' as const },
  ]

  it('sums inflow/outflow/net by paid-through account', () => {
    const rows = summarizeTransactionFlows(
      [
        {
          date: new Date('2026-08-10T00:00:00+05:30'),
          direction: 'INFLOW',
          amount: 10000,
          paidThroughAccountId: 'fa_anil',
        },
        {
          date: new Date('2026-08-11T00:00:00+05:30'),
          direction: 'OUTFLOW',
          amount: 2500,
          paidThroughAccountId: 'fa_anil',
        },
        {
          date: new Date('2026-08-12T00:00:00+05:30'),
          direction: 'OUTFLOW',
          amount: 500,
          paidThroughAccountId: 'fa_bank',
        },
      ],
      accounts,
    )
    expect(rows.find((r) => r.accountId === 'fa_anil')).toMatchObject({
      inflow: 10000,
      outflow: 2500,
      net: 7500,
    })
    expect(rows.find((r) => r.accountId === 'fa_bank')).toMatchObject({
      inflow: 0,
      outflow: 500,
      net: -500,
    })
  })
})

describe('summarizeDashboardKpis', () => {
  it('income from txn inflows; opex = all outflows except Inventory purchases', () => {
    const k = summarizeDashboardKpis(
      [
        {
          orderCreatedAt: new Date('2026-08-05T10:00:00+05:30'),
          cost: 10000,
          sellingPrice: 18000,
          paidToAccountId: 'fa_anil',
        },
      ],
      [
        {
          date: new Date('2026-08-10T00:00:00+05:30'),
          direction: 'OUTFLOW',
          amount: 2000,
          relatedToOrder: false,
          categoryName: 'Rent',
        },
        {
          date: new Date('2026-08-11T00:00:00+05:30'),
          direction: 'OUTFLOW',
          amount: 5000,
          relatedToOrder: true,
          categoryName: 'Inventory purchases',
        },
        {
          date: new Date('2026-08-11T12:00:00+05:30'),
          direction: 'OUTFLOW',
          amount: 1500,
          relatedToOrder: true,
          categoryName: 'Marketing',
        },
        {
          date: new Date('2026-08-12T00:00:00+05:30'),
          direction: 'INFLOW',
          amount: 900,
          relatedToOrder: false,
        },
        {
          date: new Date('2026-08-13T00:00:00+05:30'),
          direction: 'INFLOW',
          amount: 17100,
          relatedToOrder: true,
        },
      ],
    )
    expect(k).toEqual({
      income: 18000,
      selling: 18000,
      purchasePrice: 10000,
      orderProfit: 8000,
      orderProfitPct: 44.4,
      sheetCount: 1,
      generalExpenses: 3500,
      profit: 4500,
    })
  })
})

describe('findSheetInflowMismatches', () => {
  it('flags orders where sheet selling ≠ linked INFLOW total', () => {
    const mismatches = findSheetInflowMismatches(
      [
        {
          orderId: 'ord_a',
          orderLabel: 'Priya',
          orderCreatedAt: new Date('2026-08-05T10:00:00+05:30'),
          cost: 10000,
          sellingPrice: 18000,
          paidToAccountId: 'fa_bank',
        },
        {
          orderId: 'ord_b',
          orderLabel: 'Matched',
          orderCreatedAt: new Date('2026-08-06T10:00:00+05:30'),
          cost: 5000,
          sellingPrice: 9000,
          paidToAccountId: 'fa_bank',
        },
      ],
      [
        { date: new Date('2026-08-05T12:00:00+05:30'), amount: 10000, orderIds: ['ord_a'] },
        { date: new Date('2026-08-06T12:00:00+05:30'), amount: 9000, orderIds: ['ord_b'] },
      ],
    )
    expect(mismatches).toEqual([
      {
        orderId: 'ord_a',
        orderLabel: 'Priya',
        sheetSelling: 18000,
        inflowTotal: 10000,
      },
    ])
  })

  it('prefers FinanceAllocation amounts over even-split of txn amount', () => {
    const mismatches = findSheetInflowMismatches(
      [
        {
          orderId: 'ord_a',
          orderLabel: 'A',
          orderCreatedAt: new Date('2026-08-05T10:00:00+05:30'),
          cost: 10000,
          sellingPrice: 12000,
          paidToAccountId: 'fa_bank',
        },
        {
          orderId: 'ord_b',
          orderLabel: 'B',
          orderCreatedAt: new Date('2026-08-05T10:00:00+05:30'),
          cost: 5000,
          sellingPrice: 8000,
          paidToAccountId: 'fa_bank',
        },
      ],
      [
        {
          date: new Date('2026-08-05T12:00:00+05:30'),
          amount: 20000,
          orderIds: ['ord_a', 'ord_b'],
          allocations: [
            { orderId: 'ord_a', amount: 12000 },
            { orderId: 'ord_b', amount: 8000 },
          ],
        },
      ],
    )
    expect(mismatches).toEqual([])
  })
})

describe('summarizeTransactionReport', () => {
  it('splits inflow/outflow by category and builds monthly buckets', () => {
    const r = summarizeTransactionReport([
      {
        date: new Date('2026-08-05T00:00:00+05:30'),
        direction: 'OUTFLOW',
        amount: 5000,
        categoryId: 'fc_logistics',
        categoryName: 'Logistics',
      },
      {
        date: new Date('2026-08-06T00:00:00+05:30'),
        direction: 'OUTFLOW',
        amount: 2000,
        categoryId: 'fc_ops',
        categoryName: 'Operations',
      },
      {
        date: new Date('2026-08-10T00:00:00+05:30'),
        direction: 'INFLOW',
        amount: 12000,
        categoryId: 'fc_customer',
        categoryName: 'Customer payment',
      },
      {
        date: new Date('2026-07-01T00:00:00+05:30'),
        direction: 'INFLOW',
        amount: 1000,
        categoryId: null,
        categoryName: null,
      },
    ])
    expect(r.inflow).toBe(13000)
    expect(r.outflow).toBe(7000)
    expect(r.net).toBe(6000)
    expect(r.outflowByCategory[0]).toMatchObject({
      categoryName: 'Logistics',
      amount: 5000,
      pct: 71.43,
    })
    expect(r.inflowByCategory.find((c) => c.categoryName === 'Uncategorized')?.amount).toBe(1000)
    expect(r.byMonth).toHaveLength(2)
  })

  it('filters to an IST calendar quarter', () => {
    const rows = [
      {
        date: new Date('2026-03-31T23:00:00+05:30'),
        direction: 'INFLOW' as const,
        amount: 100,
        categoryId: null,
        categoryName: null,
      },
      {
        date: new Date('2026-04-01T00:00:00+05:30'),
        direction: 'INFLOW' as const,
        amount: 200,
        categoryId: null,
        categoryName: null,
      },
      {
        date: new Date('2026-06-30T12:00:00+05:30'),
        direction: 'OUTFLOW' as const,
        amount: 50,
        categoryId: null,
        categoryName: null,
      },
      {
        date: new Date('2026-07-01T00:00:00+05:30'),
        direction: 'OUTFLOW' as const,
        amount: 999,
        categoryId: null,
        categoryName: null,
      },
    ]
    const r = summarizeTransactionReport(rows, istQuarterUtcRange(2026, 2))
    expect(r.inflow).toBe(200)
    expect(r.outflow).toBe(50)
    expect(r.byMonth).toHaveLength(2)
  })
})

describe('istStartOfDayUtc', () => {
  it('returns start of yesterday IST as UTC', () => {
    // 2026-08-23 10:00 IST = 2026-08-23 04:30 UTC
    const now = new Date('2026-08-23T04:30:00.000Z')
    const startYesterday = istStartOfDayUtc(1, now)
    // 22 Aug 00:00 IST
    expect(startYesterday.toISOString()).toBe('2026-08-21T18:30:00.000Z')
  })
})
