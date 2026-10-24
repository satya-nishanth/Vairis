import {
  calculateEffectiveGoldRate,
  computeComplexEstimate,
  computeStandardEstimate,
  diamondSetLineCost,
  filterDecimalInput,
  parseNum,
} from '@/lib/jewellery-cost-estimator'

describe('jewellery cost estimator', () => {
  it('applies purity multiplier + ₹100 uplift to gold rate', () => {
    expect(calculateEffectiveGoldRate(10000, 18, true)).toBe(7600)
  })

  it('computes standard estimate matching HTML formula', () => {
    const r = computeStandardEstimate({
      goldRate: '10000',
      diamondRate: '21000',
      weight: '5',
      carats: '0.5',
      karat: 18,
      wastage: '10',
      gst: '3',
      making: '750',
      additional: '500',
    })
    expect(r.effectiveGoldRate).toBe(7600)
    expect(r.goldCost).toBe(38000)
    expect(r.diamondCost).toBe(10500)
    expect(r.wastageCost).toBe(3800)
    expect(r.makingCost).toBe(3750)
    expect(r.totalBeforeGst).toBe(56050)
    expect(r.gstAmount).toBeCloseTo(1681.5)
    expect(r.finalTotal).toBeCloseTo(58231.5)
  })

  it('treats a lone comma as decimal separator (EU mobile keyboards)', () => {
    expect(filterDecimalInput('5,25')).toBe('5.25')
    expect(parseNum(filterDecimalInput('5,25'))).toBe(5.25)
  })

  it('computes with plain digit strings', () => {
    const r = computeStandardEstimate({
      goldRate: '13040',
      diamondRate: '30000',
      weight: '5',
      carats: '0.5',
      karat: 18,
      wastage: '10',
      gst: '3',
      making: '750',
      additional: '',
    })
    expect(r.finalTotal).toBeGreaterThan(0)
    expect(r.goldCost).toBeGreaterThan(0)
  })

  it('sums multiple diamond sets in complex mode', () => {
    expect(diamondSetLineCost({ carats: '1', costPerCarat: '20000' })).toBe(20000)
    const r = computeComplexEstimate({
      goldRate: '10000',
      weight: '2',
      karat: 18,
      wastage: '10',
      gst: '3',
      making: '750',
      additional: '',
      diamondSets: [
        { id: 1, name: 'A', carats: '0.3', costPerCarat: '20000' },
        { id: 2, name: 'B', carats: '0.2', costPerCarat: '15000' },
      ],
    })
    expect(r.diamondCost).toBe(6000 + 3000)
  })
})
