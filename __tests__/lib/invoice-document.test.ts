import { DEFAULT_PRICING_CONFIG } from '@/lib/pricing'
import {
  applyInvoiceSeller,
  applyInvoiceExchangeFlag,
  invoiceFromProducts,
  lineFromOrderItem,
  payloadFromOrder,
  recomputeLine,
  sellerDefaults,
  type PrefillOrder,
} from '@/lib/invoice-document'

describe('invoiceFromProducts', () => {
  it('builds a tax invoice from a product list using calculatePrice', () => {
    const { payload, totals } = invoiceFromProducts(
      [
        {
          productName: 'Solitaire ring',
          itemCode: 'VR-01',
          sku: 'VR-01-18K',
          metalType: 'GOLD_18K',
          quantity: 1,
          withExchange: true,
          weightGrams: 4.2,
          makingChargePerGram: 1000,
          stones: [
            { caratWeight: 0.44, ratePerCarat: 95000, ratePerCaratExchange: 95000, typeLabel: 'White dia' },
            { caratWeight: 0.08, ratePerCarat: 140000, ratePerCaratExchange: 140000, typeLabel: 'Fancy yellow' },
          ],
        },
      ],
      {
        goldRates: { GOLD_18K: 6100 },
        config: DEFAULT_PRICING_CONFIG,
        billedTo: { name: 'Test', lines: 'Mumbai', phone: '' },
        placeOfSupply: 'Maharashtra (27)',
      },
    )

    expect(payload.lines).toHaveLength(1)
    expect(payload.lines[0].goldValue).toBe(25620)
    expect(payload.lines[0].wastage).toBe(2562)
    expect(payload.lines[0].making).toBe(4200)
    expect(payload.lines[0].stoneValue).toBe(53000)
    expect(payload.lines[0].diamondValue).toBe(53000)
    expect(payload.lines[0].otherStoneValue).toBe(0)
    expect(payload.lines[0].taxable).toBe(85382)
    expect(totals.taxable).toBe(85382)
    expect(totals.gstAmount).toBeCloseTo(85382 * 0.03, 6)
    expect(totals.intraState).toBe(true)
  })

  it('applies quantity to taxable and uses IGST outside Maharashtra', () => {
    const { totals } = invoiceFromProducts(
      [
        {
          productName: 'Band',
          metalType: 'GOLD_18K',
          quantity: 2,
          weightGrams: 5,
          makingChargePerGram: 100,
        },
      ],
      {
        goldRates: { GOLD_18K: 6000 },
        config: DEFAULT_PRICING_CONFIG,
        placeOfSupply: 'Karnataka',
      },
    )
    // unit taxable 33500 × qty 2
    expect(totals.taxable).toBe(67000)
    expect(totals.igst).toBe(67000 * 0.03)
    expect(totals.cgst).toBe(0)
  })
})

describe('order invoice from priceBreakdown', () => {
  const snap = {
    goldValue: 21516.35,
    goldVA: 1075.82,
    making: 1100,
    stoneValue: 0,
    stoneLines: [] as {
      typeLabel: string
      caratWeight: number
      ratePerCarat: number
      value: number
    }[],
    stoneVA: 0,
    vaTotal: 1075.82,
    vaLabel: 'Value Addition',
    miscCharges: 45,
    taxable: 23737.17,
    gst: 712.11,
    total: 24449.28,
    withExchange: false,
    goldRatePerGram: 9780.16,
    weightGrams: 2.2,
    metalType: 'GOLD_18K',
    capturedAt: '2026-08-24T10:10:54.783Z',
  }

  const orderItem: PrefillOrder['items'][number] = {
    productName: 'Heart Solitaire Diamond Ring',
    quantity: 1,
    withExchange: false,
    priceBreakdown: snap,
    variant: {
      sku: 'AJLR-598-G18K-12',
      metalType: 'GOLD_18K',
      weightGrams: 2.2,
      makingChargePerGram: 500,
      flatMakingCharge: 0,
      miscCharges: 45,
      stoneCharges: 0,
      product: { itemCode: 'AJLR-598', stones: [] },
    },
  }

  it('uses frozen snapshot amounts even when live gold rate differs', () => {
    const line = lineFromOrderItem(orderItem, { GOLD_18K: 99999 }, DEFAULT_PRICING_CONFIG)
    expect(line.lockedPricing).toBe(true)
    expect(line.goldRatePerGram).toBe(9780.16)
    expect(line.goldValue).toBeCloseTo(21516.35, 2)
    expect(line.wastage).toBeCloseTo(1075.82, 2)
    expect(line.making).toBe(1100)
    expect(line.taxable).toBeCloseTo(23737.17, 2)
    expect(line.miscLines).toEqual([{ label: 'Delivery', amount: 45 }])

    // Live recompute would use 99999/g — locked path must not.
    const again = recomputeLine({ ...line, goldRatePerGram: 99999 }, 'Wastage')
    expect(again.goldValue).toBeCloseTo(21516.35, 2)
    expect(again.taxable).toBeCloseTo(23737.17, 2)
  })

  it('keeps multiple labeled misc lines in taxable and on the line', () => {
    const line = recomputeLine(
      {
        ...lineFromOrderItem(orderItem, { GOLD_18K: 9780.16 }, DEFAULT_PRICING_CONFIG),
        lockedPricing: false,
        miscLines: [
          { label: 'Hallmark', amount: 800 },
          { label: 'Certificate', amount: 200 },
        ],
        miscCharges: 1000,
      },
      'Wastage',
    )
    expect(line.miscCharges).toBe(1000)
    expect(line.miscLines).toEqual([
      { label: 'Hallmark', amount: 800 },
      { label: 'Certificate', amount: 200 },
    ])
    expect(line.taxable).toBeGreaterThan(0)
  })

  it('payloadFromOrder keeps snapshot taxable on the invoice', () => {
    const order: PrefillOrder = {
      id: 'ord_test',
      status: 'PAYMENT_CONFIRMED',
      createdAt: new Date('2026-08-24T10:00:00Z'),
      contactName: 'Test',
      contactPhone: '9876543210',
      addressLine1: '12 MG Road',
      addressLine2: null,
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      user: { name: 'Test', email: 't@example.com' },
      payment: {
        razorpayPaymentId: 'pay_x',
        razorpayOrderId: 'order_x',
        status: 'CAPTURED',
        createdAt: new Date('2026-08-24T10:00:00Z'),
      },
      items: [orderItem],
    }
    const payload = payloadFromOrder(order, { GOLD_18K: 99999 }, DEFAULT_PRICING_CONFIG)
    expect(payload.lines[0].lockedPricing).toBe(true)
    expect(payload.lines[0].goldValue).toBeCloseTo(21516.35, 2)
    expect(payload.lines[0].taxable).toBeCloseTo(23737.17, 2)
    expect(payload.invoiceDate).toBe('2026-08-24')
    expect(payload.billedTo.name).toBe('Test')
    expect(payload.billedTo.phone).toBe('+91 9876543210')
    expect(payload.billedTo.lines).toContain('12 MG Road')
    // Legacy snap with stoneValue only → entire gem lump on Diamonds, Stones 0
    expect(payload.lines[0].diamondValue).toBe(0)
    expect(payload.lines[0].otherStoneValue).toBe(0)
  })

  it('payloadFromOrder puts diamondValue on Diamonds and otherStoneValue on Stones', () => {
    const order: PrefillOrder = {
      id: 'ord_gems',
      status: 'PAYMENT_CONFIRMED',
      createdAt: new Date('2026-08-24T10:00:00Z'),
      contactName: 'Test',
      contactPhone: '9876543210',
      addressLine1: '12 MG Road',
      addressLine2: null,
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      user: { name: 'Test', email: 't@example.com' },
      payment: {
        razorpayPaymentId: 'pay_x',
        razorpayOrderId: 'order_x',
        status: 'CAPTURED',
        createdAt: new Date('2026-08-24T10:00:00Z'),
      },
      items: [
        {
          ...orderItem,
          priceBreakdown: {
            ...snap,
            stoneValue: 93600,
            diamondValue: 93600,
            otherStoneValue: 0,
            stoneLines: [
              {
                typeLabel: 'Colourless Diamond',
                caratWeight: 0.5,
                ratePerCarat: 187200,
                value: 93600,
              },
            ],
            taxable: 21516.35 + 1075.82 + 1100 + 93600 + 45,
            gst: 0,
            total: 0,
          },
        },
      ],
    }
    const payload = payloadFromOrder(order, { GOLD_18K: 99999 }, DEFAULT_PRICING_CONFIG)
    expect(payload.lines[0].diamondValue).toBe(93600)
    expect(payload.lines[0].otherStoneValue).toBe(0)
    expect(payload.lines[0].stoneValue).toBe(93600)
  })

  it('applyInvoiceExchangeFlag swaps ₹/ct and flag without unlocking gold/making', () => {
    const line = lineFromOrderItem(
      {
        ...orderItem,
        withExchange: false,
        priceBreakdown: {
          ...snap,
          withExchange: false,
          stoneValue: 21000 * 0.5,
          diamondValue: 21000 * 0.5,
          otherStoneValue: 0,
          stoneLines: [
            {
              typeLabel: 'Colourless Diamond',
              caratWeight: 0.5,
              ratePerCarat: 21000,
              value: 10500,
            },
          ],
          taxable: 21516.35 + 1075.82 + 1100 + 10500 + 45,
        },
        variant: {
          ...orderItem.variant,
          product: {
            itemCode: 'AJLR-598',
            stones: [
              {
                caratWeight: 0.5,
                diamondRate: {
                  label: 'Colourless Diamond',
                  ratePerCarat: 21000,
                  ratePerCaratExchange: 30000,
                },
              },
            ],
          },
        },
      },
      { GOLD_18K: 99999 },
      DEFAULT_PRICING_CONFIG,
    )
    expect(line.lockedPricing).toBe(true)
    expect(line.withExchange).toBe(false)
    expect(line.goldValue).toBeCloseTo(21516.35, 2)

    const exchanged = applyInvoiceExchangeFlag(line, true)
    expect(exchanged.lockedPricing).toBe(true)
    expect(exchanged.withExchange).toBe(true)
    expect(exchanged.goldValue).toBeCloseTo(21516.35, 2)
    expect(exchanged.making).toBe(1100)
    expect(exchanged.wastage).toBeCloseTo(1075.82, 2)
    expect(exchanged.stones[0].ratePerCarat).toBe(30000)
    expect(exchanged.stones[0].exchange).toBe(true)
    // Diamonds ₹ total stays — already the settled amount
    expect(exchanged.diamondValue).toBe(line.diamondValue)
    expect(exchanged.stoneValue).toBe(line.stoneValue)
    expect(exchanged.stones[0].value).toBe(line.stones[0].value)
    expect(exchanged.taxable).toBe(line.taxable)
  })

  it('payloadFromOrder uses paymentReceivedAt for Received On when offline', () => {
    const order: PrefillOrder = {
      id: 'ord_offline',
      status: 'PAYMENT_CONFIRMED',
      createdAt: new Date('2026-08-24T10:00:00Z'),
      paymentReceivedAt: new Date('2026-09-01T12:00:00Z'),
      contactName: 'Test',
      contactPhone: '9876543210',
      addressLine1: '12 MG Road',
      addressLine2: null,
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      user: { name: 'Test', email: 't@example.com' },
      payment: null,
      items: [orderItem],
    }
    const payload = payloadFromOrder(order, { GOLD_18K: 99999 }, DEFAULT_PRICING_CONFIG)
    expect(payload.payment.status).toBe('Paid in full')
    expect(payload.payment.method).toBe('Offline')
    expect(payload.payment.received).toBe('2026-09-01')
  })
})

describe('sellerDefaults', () => {
  it('uses the Hyderabad company constants', () => {
    expect(sellerDefaults()).toEqual({
      name: 'Vairis Fine Jewellery Private Limited',
      email: 'contact@thevairis.com',
      phone: '+91 7075486464',
      address:
        'Sy.130p&115/1p, Nanakramguda Rd, M, Gachibowli, Serilingampalle (M), Hyderabad, Telangana 500032',
      gstin: '36AALCV9240K1ZQ',
    })
  })

  it('stamps seller even if the payload tried to override it', () => {
    const { payload } = invoiceFromProducts(
      [{ productName: 'Band', metalType: 'GOLD_18K', weightGrams: 5, makingChargePerGram: 100 }],
      { goldRates: { GOLD_18K: 6000 } },
    )
    payload.seller.name = 'Someone Else'
    expect(applyInvoiceSeller(payload).seller.name).toBe('Vairis Fine Jewellery Private Limited')
    expect(applyInvoiceSeller(payload).seller.gstin).toBe('36AALCV9240K1ZQ')
  })
})
