import { DEFAULT_PRICING_CONFIG } from '@/lib/pricing'
import { applyInvoiceSeller, invoiceFromProducts, sellerDefaults } from '@/lib/invoice-document'

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
