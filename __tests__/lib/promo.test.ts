import { computeDiscount, componentInclGst, promoPatchSchema, promoSchema } from '@/lib/promo'

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

  it('rejects codes longer than 40 characters', () => {
    const parsed = promoSchema.safeParse({
      code: 'A'.repeat(41),
      kind: 'PERCENT',
      value: 10,
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/40/)
    }
  })
})

describe('promoPatchSchema', () => {
  it('active-only PATCH does not invent value or defaults', () => {
    const parsed = promoPatchSchema.safeParse({ active: false })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toEqual({ active: false })
      expect(parsed.data.value).toBeUndefined()
      expect(parsed.data.minOrderValue).toBeUndefined()
      expect(parsed.data.maxPerUser).toBeUndefined()
    }
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
