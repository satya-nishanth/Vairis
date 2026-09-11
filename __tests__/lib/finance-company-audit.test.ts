import {
  buildCompanyAuditExceptions,
  summarizeInventoryStock,
  LARGE_OUTFLOW_THRESHOLD,
  UNPAID_PURCHASE_BILL_AGE_DAYS,
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
  const asOf = new Date('2026-09-10T00:00:00+05:30')

  it('flags sheet, settlement, allocation, aging, and review exceptions', () => {
    const exceptions = buildCompanyAuditExceptions({
      asOf,
      mismatches: [
        {
          orderId: 'ord1',
          orderLabel: 'Ada',
          sheetSelling: 100_000,
          inflowTotal: 80_000,
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
      orderPayments: [
        {
          orderId: 'ord_u',
          label: 'Unpaid cust',
          orderCreatedAt: new Date('2026-09-01T00:00:00+05:30'),
          expected: 50_000,
          collected: 0,
          paymentStatus: 'unpaid',
          grandTotal: 50_000,
          sheetSelling: 50_000,
        },
        {
          orderId: 'ord_p',
          label: 'Partial cust',
          orderCreatedAt: new Date('2026-09-01T00:00:00+05:30'),
          expected: 50_000,
          collected: 20_000,
          paymentStatus: 'partial',
          grandTotal: 40_000,
          sheetSelling: 50_000,
        },
        {
          orderId: 'ord_o',
          label: 'Overpaid cust',
          orderCreatedAt: new Date('2026-09-01T00:00:00+05:30'),
          expected: 50_000,
          collected: 55_000,
          paymentStatus: 'overpaid',
          grandTotal: 50_000,
          sheetSelling: 50_000,
        },
      ],
      purchaseBills: [
        {
          id: 'bill1',
          billNumber: 'PB-1',
          supplierName: 'Supplier A',
          date: new Date('2026-09-04T00:00:00+05:30'),
          total: 100_000,
          paid: 40_000,
          paymentStatus: 'partial',
        },
        {
          id: 'bill2',
          billNumber: 'PB-2',
          supplierName: 'Supplier B',
          date: new Date('2026-09-05T00:00:00+05:30'),
          total: 50_000,
          paid: 60_000,
          paymentStatus: 'overpaid',
        },
        {
          id: 'bill3',
          billNumber: 'PB-OLD',
          supplierName: 'Old supplier',
          date: new Date('2026-07-01T00:00:00+05:30'),
          total: 12_000,
          paid: 0,
          paymentStatus: 'unpaid',
        },
      ],
      txAllocations: [
        {
          id: 'tx3',
          date: new Date('2026-09-06T00:00:00+05:30'),
          direction: 'OUTFLOW',
          amount: 20_000,
          allocatedAmount: 5_000,
          allocatedToOrders: 0,
          allocatedToBills: 5_000,
          reviewComplete: true,
          description: 'Part paid supplier',
        },
        {
          id: 'tx4',
          date: new Date('2026-09-06T00:00:00+05:30'),
          direction: 'INFLOW',
          amount: 10_000,
          allocatedAmount: 0,
          allocatedToOrders: 0,
          allocatedToBills: 0,
          reviewComplete: true,
          description: 'Orphan cash',
        },
        {
          id: 'tx5',
          date: new Date('2026-09-06T00:00:00+05:30'),
          direction: 'INFLOW',
          amount: 8_000,
          allocatedAmount: 9_000,
          allocatedToOrders: 9_000,
          allocatedToBills: 0,
          reviewComplete: true,
          description: 'Over allocated',
        },
        {
          id: 'tx6',
          date: new Date('2026-09-06T00:00:00+05:30'),
          direction: 'INFLOW',
          amount: 7_000,
          allocatedAmount: 7_000,
          allocatedToOrders: 0,
          allocatedToBills: 7_000,
          reviewComplete: true,
          description: 'Wrong way in',
        },
        {
          id: 'tx7',
          date: new Date('2026-09-06T00:00:00+05:30'),
          direction: 'OUTFLOW',
          amount: 6_000,
          allocatedAmount: 6_000,
          allocatedToOrders: 6_000,
          allocatedToBills: 0,
          reviewComplete: true,
          description: 'Wrong way out',
        },
        {
          id: 'tx8',
          date: new Date('2026-09-06T00:00:00+05:30'),
          direction: 'INFLOW',
          amount: 1_000,
          allocatedAmount: 1_000,
          allocatedToOrders: 1_000,
          allocatedToBills: 0,
          reviewComplete: false,
          description: 'Needs review',
        },
      ],
    })

    expect(exceptions.map((e) => e.kind)).toEqual(
      expect.arrayContaining([
        'sheet_inflow_mismatch',
        'stock_missing_valuation',
        'large_non_order_outflow',
        'sold_orphan',
        'order_unpaid',
        'order_partial',
        'order_overpaid',
        'sheet_checkout_mismatch',
        'purchase_bill_partial',
        'purchase_bill_overpaid',
        'purchase_bill_unpaid_aged',
        'txn_partial_allocation',
        'txn_unallocated_inflow',
        'txn_over_allocated',
        'txn_inflow_to_purchase_bill',
        'txn_outflow_to_order',
        'txn_for_review',
      ]),
    )
    expect(exceptions.map((e) => e.kind)).not.toContain('inflow_no_order')
    expect(exceptions[0].severity).toBe('red')
    const aged = exceptions.find((e) => e.kind === 'purchase_bill_unpaid_aged')
    expect(aged?.detail).toContain(String(UNPAID_PURCHASE_BILL_AGE_DAYS))
  })
})
