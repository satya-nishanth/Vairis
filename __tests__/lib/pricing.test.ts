import { calculatePrice, DEFAULT_PRICING_CONFIG, toOrderItemPriceSnapshot, isOrderItemPriceSnapshot, sellingComponentsToUnitSnapshot, unitSnapshotToSellingComponents, sellingBreakdownMatchesGoods } from '@/lib/pricing'
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

    const snap = toOrderItemPriceSnapshot(b, {
      goldRatePerGram: 6000,
      weightGrams: 5,
      metalType: 'GOLD_22K',
    })
    expect(snap.goldRatePerGram).toBe(6000)
    expect(snap.weightGrams).toBe(5)
    expect(isOrderItemPriceSnapshot(snap)).toBe(true)
    expect(isOrderItemPriceSnapshot(null)).toBe(false)
  })

  it('builds a unit snapshot from admin selling components (order totals ÷ qty)', () => {
    const snap = sellingComponentsToUnitSnapshot(
      {
        gold: 60_000,
        diamonds: 40_000,
        stones: 0,
        making: 8_000,
        wastage: 6_000,
        delivery: 2_000,
        gst: 3_420,
      },
      {
        quantity: 2,
        goldRatePerGram: 6000,
        weightGrams: 5,
        metalType: 'GOLD_22K',
      },
    )
    expect(snap.goldValue).toBe(30_000)
    expect(snap.stoneValue).toBe(20_000)
    expect(snap.diamondValue).toBe(20_000)
    expect(snap.otherStoneValue).toBe(0)
    expect(snap.making).toBe(4_000)
    expect(snap.goldVA).toBe(3_000)
    expect(snap.miscCharges).toBe(1_000)
    expect(snap.gst).toBe(1_710)
    expect(snap.taxable).toBe(58_000)
    expect(snap.total).toBe(59_710)
    expect(isOrderItemPriceSnapshot(snap)).toBe(true)
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
    expect(b.diamondValue).toBe(53000)
    expect(b.otherStoneValue).toBe(0)
    expect(b.taxable).toBe(85382)
  })

  it('splits ruby into otherStoneValue and diamond lines into diamondValue', () => {
    const b = calculatePrice(
      {
        weightGrams: 1,
        makingChargePerGram: 0,
        flatMakingCharge: 0,
        stoneCharges: 500,
        miscCharges: 0,
      },
      1000,
      {
        config: DEFAULT_PRICING_CONFIG,
        stones: [
          { caratWeight: 1, ratePerCarat: 10000, ratePerCaratExchange: 10000, typeLabel: 'Colourless Diamond' },
          { caratWeight: 0.5, ratePerCarat: 2000, ratePerCaratExchange: 2000, typeLabel: 'Ruby' },
        ],
      },
    )
    expect(b.diamondValue).toBe(10000)
    expect(b.otherStoneValue).toBe(1500) // ruby 1000 + legacy 500
    expect(b.stoneValue).toBe(11500)
  })

  it('preserves diamonds vs stones when building selling-component snapshots', () => {
    const snap = sellingComponentsToUnitSnapshot(
      {
        gold: 10_000,
        diamonds: 8_000,
        stones: 2_000,
        making: 1_000,
        wastage: 500,
        delivery: 0,
        gst: 500,
      },
      { quantity: 1, goldRatePerGram: 7000, weightGrams: 2 },
    )
    expect(snap.diamondValue).toBe(8_000)
    expect(snap.otherStoneValue).toBe(2_000)
    expect(snap.stoneValue).toBe(10_000)
  })

  it('maps discount into autoDiscount / payable and round-trips', () => {
    const snap = sellingComponentsToUnitSnapshot(
      {
        gold: 10_000,
        diamonds: 0,
        stones: 0,
        making: 1_000,
        wastage: 500,
        delivery: 0,
        gst: 345,
        discount: 200,
      },
      { quantity: 1, goldRatePerGram: 7000, weightGrams: 2 },
    )
    expect(snap.total).toBe(11_845)
    expect(snap.autoDiscount).toBe(200)
    expect(snap.autoDiscountLabel).toBe('Discount')
    expect(snap.payable).toBe(11_645)
    const selling = unitSnapshotToSellingComponents(snap, 1)
    expect(selling.discount).toBe(200)
    expect(selling.gold + selling.making + selling.wastage + selling.gst - selling.discount).toBe(11_645)
  })

  it('stores labeled misc lines on the unit snapshot for invoices', () => {
    const snap = sellingComponentsToUnitSnapshot(
      {
        gold: 10_000,
        diamonds: 0,
        stones: 0,
        making: 1_000,
        wastage: 500,
        miscLines: [
          { label: 'Hallmark', amount: 800 },
          { label: 'Certificate', amount: 200 },
        ],
        gst: 375,
      },
      { quantity: 1, goldRatePerGram: 7000, weightGrams: 2 },
    )
    expect(snap.miscCharges).toBe(1_000)
    expect(snap.miscLines).toEqual([
      { label: 'Hallmark', amount: 800 },
      { label: 'Certificate', amount: 200 },
    ])
    const selling = unitSnapshotToSellingComponents(snap, 1)
    expect(selling.miscLines).toEqual([
      { label: 'Hallmark', amount: 800 },
      { label: 'Certificate', amount: 200 },
    ])
    expect(selling.delivery).toBe(1_000)
  })

  it('sellingBreakdownMatchesGoods accepts net or gross equality', () => {
    const components = {
      gold: 30_000,
      diamonds: 0,
      stones: 0,
      making: 5_000,
      wastage: 5_000,
      delivery: 0,
      gst: 5_000,
      discount: 1_000,
    }
    expect(sellingBreakdownMatchesGoods(components, 44_000)).toBe(true) // net
    expect(sellingBreakdownMatchesGoods(components, 45_000)).toBe(true) // gross (edit)
    expect(sellingBreakdownMatchesGoods(components, 40_000)).toBe(false)
    expect(
      sellingBreakdownMatchesGoods(components, 45_000, { requireNetIfDiscounted: true }),
    ).toBe(false)
    expect(
      sellingBreakdownMatchesGoods(components, 44_000, { requireNetIfDiscounted: true }),
    ).toBe(true)
  })

  it('round-trips selling components to 2 decimal places', () => {
    const snap = sellingComponentsToUnitSnapshot(
      {
        gold: 10_978.25,
        diamonds: 21_420.5,
        stones: 0,
        making: 1_105.1,
        wastage: 548.91,
        delivery: 45,
        gst: 1_022.99,
        discount: 10.5,
      },
      { quantity: 1, goldRatePerGram: 7452.78, weightGrams: 1.473 },
    )
    const selling = unitSnapshotToSellingComponents(snap, 1)
    expect(selling.gold).toBe(10_978.25)
    expect(selling.diamonds).toBe(21_420.5)
    expect(selling.making).toBe(1_105.1)
    expect(selling.wastage).toBe(548.91)
    expect(selling.gst).toBe(1_022.99)
    expect(selling.discount).toBe(10.5)
    expect(
      sellingBreakdownMatchesGoods(selling, 10_978.25 + 21_420.5 + 1_105.1 + 548.91 + 45 + 1_022.99 - 10.5),
    ).toBe(true)
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
    expect(t.cgstRateLabel).toBe('1.5%')
    expect(t.igstRateLabel).toBe('3%')
    expect(t.hsnCode).toBe('7113')
  })

  it('uses IGST for other states', () => {
    const t = splitInvoiceTax(10000, 'Karnataka')
    expect(t.intraState).toBe(false)
    expect(t.igst).toBe(300)
    expect(t.cgst).toBe(0)
    expect(t.sgst).toBe(0)
    expect(t.grandTotal).toBe(10300)
  })

  it('applies loose-diamond 1.5% as 0.75% CGST + 0.75% SGST in Maharashtra', () => {
    const t = splitInvoiceTax(100000, 'Maharashtra (27)', 'LOOSE_DIAMONDS')
    expect(t.gstAmount).toBe(1500)
    expect(t.cgst).toBe(750)
    expect(t.sgst).toBe(750)
    expect(t.igst).toBe(0)
    expect(t.grandTotal).toBe(101500)
    expect(t.cgstRateLabel).toBe('0.75%')
    expect(t.igstRateLabel).toBe('1.5%')
    expect(t.hsnCode).toBe('7104')
  })

  it('applies loose-diamond IGST 1.5% outside Maharashtra', () => {
    const t = splitInvoiceTax(100000, 'Karnataka', 'LOOSE_DIAMONDS')
    expect(t.igst).toBe(1500)
    expect(t.cgst).toBe(0)
    expect(t.sgst).toBe(0)
    expect(t.grandTotal).toBe(101500)
  })

  it('subtracts post-GST discount from rounded payable', () => {
    const t = splitInvoiceTax(10000, 'Karnataka', 'JEWELLERY', 500)
    expect(t.roundOff).toBe(0)
    expect(t.discount).toBe(500)
    expect(t.grandTotal).toBe(9800)
  })
})

describe('amountInWords', () => {
  it('renders the sample total', () => {
    expect(amountInWords(165976)).toBe(
      'Rupees One Lakh Sixty Five Thousand Nine Hundred and Seventy Six Only',
    )
  })
})
