import {
  buildCompanyAuditExceptions,
  summarizeInventoryStock,
  LARGE_OUTFLOW_THRESHOLD,
} from '@/lib/finance-company-audit'

describe('summarizeInventoryStock', () => {
  it('values stock at cost and potential with live fallback', () => {
    const summary = summarizeInventoryStock(
      [
        {
          id: '1',
          label: 'Ring',
          qtyOnHand: 2,
          purchasePrice: 50_000,
          potentialPrice: 80_000,
          variantId: null,
        },
        {
          id: '2',
          label: 'Catalogue',
          qtyOnHand: 1,
          purchasePrice: 40_000,
          potentialPrice: null,
          variantId: 'v1',
        },
        {
          id: '3',
          label: 'Sold out',
          qtyOnHand: 0,
          purchasePrice: 10_000,
          potentialPrice: 20_000,
          variantId: null,
        },
      ],
      { v1: 70_000 },
    )
    expect(summary.stockAtCost).toBe(140_000)
    expect(summary.stockAtPotential).toBe(230_000)
    expect(summary.unrealizedMargin).toBe(90_000)
    expect(summary.inStockLines).toBe(2)
  })
})

describe('buildCompanyAuditExceptions', () => {
  it('flags sheet mismatches, orphan inflows, missing purchase, large outflows', () => {
    const exceptions = buildCompanyAuditExceptions({
      mismatches: [
        {
          orderId: 'ord1',
          orderLabel: 'Ada',
          sheetSelling: 100_000,
          inflowTotal: 80_000,
        },
      ],
      inflows: [
        {
          id: 'tx1',
          date: new Date('2026-09-01T00:00:00+05:30'),
          amount: 25_000,
          orderIds: [],
          unlinkedOrderLabels: [],
        },
      ],
      outflows: [
        {
          id: 'tx2',
          date: new Date('2026-09-02T00:00:00+05:30'),
          amount: LARGE_OUTFLOW_THRESHOLD,
          relatedToOrder: false,
          description: 'Karigar advance',
        },
      ],
      stockRows: [
        {
          id: 'inv1',
          label: 'Necklace',
          qtyOnHand: 1,
          purchasePrice: null,
          potentialPrice: null,
          variantId: null,
        },
      ],
      sales: [
        {
          id: 'sale1',
          itemId: 'inv2',
          itemLabel: 'Bangle',
          qty: 1,
          orderId: null,
          unlinkedOrderLabel: null,
          soldAt: new Date('2026-09-03T00:00:00+05:30'),
        },
      ],
      liveByVariantId: {},
    })

    expect(exceptions.map((e) => e.kind)).toEqual(
      expect.arrayContaining([
        'sheet_inflow_mismatch',
        'inflow_no_order',
        'stock_missing_purchase',
        'stock_missing_valuation',
        'large_non_order_outflow',
        'sold_orphan',
      ]),
    )
    expect(exceptions[0].severity).toBe('red')
  })
})
