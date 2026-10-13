import { computeDiscount, componentInclGst, promoSchema } from '@/lib/promo'

describe('promoSchema', () => {
  it('accepts FREE_DELIVERY with zero value', () => {
    const parsed = promoSchema.safeParse({
      code: 'FREEDEL',
      kind: 'FREE_DELIVERY',
      value: 0,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects percent over 100 for MAKING_PERCENT', () => {
    const parsed = promoSchema.safeParse({
      code: 'MAKE',
      kind: 'MAKING_PERCENT',
      value: 120,
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts firstOrderOnly', () => {
    const parsed = promoSchema.safeParse({
      code: 'WELCOME',
      kind: 'PERCENT',
      value: 10,
      firstOrderOnly: true,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.firstOrderOnly).toBe(true)
  })
})

describe('computeDiscount kinds', () => {
  it('MAKING_PERCENT caps by making and maxDiscount', () => {
    expect(
      computeDiscount(
        { kind: 'MAKING_PERCENT', value: 50 as never, maxDiscount: 500 as never },
        { cartBase: 20000, makingBase: 4000, deliveryBase: 0 },
      ),
    ).toBe(500)
  })

  it('componentInclGst zero when component is zero', () => {
    expect(componentInclGst(0, 1000, 30)).toBe(0)
  })
})
