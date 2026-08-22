import { calculatePrice, DEFAULT_PRICING_CONFIG } from '@/lib/pricing'
import { amountInWords, splitInvoiceTax } from '@/lib/invoice-tax'

describe('calculatePrice (estimator formula)', () => {
  it('applies 10% wastage on gold only and 3% GST on full taxable', () => {
    const b = calculatePrice(
      {
        weightGrams: 5,
        makingChargePerGram: 100,
        flatMakingCharge: 0,
        stoneCharges: 0,
        miscCharges: 0,
      },
      6000,
      { config: DEFAULT_PRICING_CONFIG },
    )
    // gold 30000, wastage 3000, making 500, taxable 33500, GST 1005, total 34505
    expect(b.goldValue).toBe(30000)
    expect(b.goldVA).toBe(3000)
    expect(b.stoneVA).toBe(0)
    expect(b.making).toBe(500)
    expect(b.taxable).toBe(33500)
    expect(b.gst).toBe(1005)
    expect(b.total).toBe(34505)
  })

  it('matches the tax-invoice sample line (4.200 g @ 6100, 10% wastage, making 1000/g, stones 53000)', () => {
    const b = calculatePrice(
      {
        weightGrams: 4.2,
        makingChargePerGram: 1000,
        flatMakingCharge: 0,
        stoneCharges: 0,
        miscCharges: 0,
      },
      6100,
      {
        config: { vaGoldPct: 10, vaStonePct: 0, vaLabel: 'Wastage' },
        stones: [
          { caratWeight: 0.44, ratePerCarat: 95000, ratePerCaratExchange: 95000, typeLabel: 'White dia' },
          { caratWeight: 0.08, ratePerCarat: 140000, ratePerCaratExchange: 140000, typeLabel: 'Fancy yellow' },
        ],
        withExchange: true,
      },
    )
    expect(b.goldValue).toBe(25620)
    expect(b.goldVA).toBe(2562)
    expect(b.making).toBe(4200)
    expect(b.stoneValue).toBe(53000)
    expect(b.taxable).toBe(85382)
  })

  it('does not apply stone VA even when vaStonePct is set', () => {
    const b = calculatePrice(
      {
        weightGrams: 1,
        makingChargePerGram: 0,
        flatMakingCharge: 0,
        stoneCharges: 0,
        miscCharges: 0,
      },
      1000,
      {
        config: { vaGoldPct: 10, vaStonePct: 5, vaLabel: 'Wastage' },
        stones: [{ caratWeight: 1, ratePerCarat: 10000, ratePerCaratExchange: 10000 }],
      },
    )
    expect(b.stoneValue).toBe(10000)
    expect(b.stoneVA).toBe(0)
    expect(b.taxable).toBe(1000 + 100 + 10000)
  })
})

describe('splitInvoiceTax', () => {
  it('splits 3% into CGST/SGST for Maharashtra and rounds like the sample footer', () => {
    const t = splitInvoiceTax(161142, 'Maharashtra (27)')
    expect(t.intraState).toBe(true)
    expect(t.gstAmount).toBeCloseTo(4834.26, 2)
    expect(t.cgst).toBeCloseTo(2417.13, 2)
    expect(t.sgst).toBeCloseTo(2417.13, 2)
    expect(t.igst).toBe(0)
    expect(t.grandTotal).toBe(165976)
    expect(t.roundOff).toBeCloseTo(-0.26, 2)
  })

  it('uses IGST for other states', () => {
    const t = splitInvoiceTax(10000, 'Karnataka')
    expect(t.intraState).toBe(false)
    expect(t.igst).toBe(300)
    expect(t.cgst).toBe(0)
    expect(t.sgst).toBe(0)
    expect(t.grandTotal).toBe(10300)
  })
})

describe('amountInWords', () => {
  it('renders the sample total', () => {
    expect(amountInWords(165976)).toBe(
      'Rupees One Lakh Sixty Five Thousand Nine Hundred and Seventy Six Only',
    )
  })
})
