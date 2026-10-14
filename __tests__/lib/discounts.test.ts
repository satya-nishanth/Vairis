import {
  computeStackedDiscounts,
  lineMatchesScope,
  isScopeEmpty,
  applyDiscountToSnapshot,
  type DiscountLineInput,
  type ScopedAuto,
  type ScopedPromo,
} from '@/lib/discounts'
import { DEFAULT_PRICING_CONFIG, calculatePrice, toOrderItemPriceSnapshot } from '@/lib/pricing'
import { componentInclGst, computeDiscount } from '@/lib/promo'

function line( partial: Partial<DiscountLineInput> & Pick<DiscountLineInput, 'key' | 'unitTotal'>): DiscountLineInput {
  return {
    variantId: partial.variantId ?? 'v1',
    productId: partial.productId ?? 'p1',
    category: partial.category ?? 'RINGS',
    collectionIds: partial.collectionIds ?? [],
    storeCategoryIds: partial.storeCategoryIds ?? [],
    quantity: partial.quantity ?? 1,
    key: partial.key,
    unitTotal: partial.unitTotal,
    unitMakingInclGst: partial.unitMakingInclGst ?? 0,
    unitDeliveryInclGst: partial.unitDeliveryInclGst ?? 0,
  }
}

function auto(
  partial: Partial<ScopedAuto> & Pick<ScopedAuto, 'id' | 'name' | 'percent'>,
): ScopedAuto {
  return {
    active: true,
    maxDiscount: null,
    startsAt: null,
    endsAt: null,
    priority: 0,
    products: [],
    collections: [],
    storeCategories: [],
    categories: [],
    ...partial,
  }
}

function coupon(
  partial: Partial<ScopedPromo> & Pick<ScopedPromo, 'id' | 'code' | 'kind' | 'value'>,
): ScopedPromo {
  return {
    description: null,
    minOrderValue: 0 as never,
    maxDiscount: null,
    startsAt: null,
    endsAt: null,
    maxRedemptions: null,
    maxPerUser: 1,
    firstOrderOnly: false,
    active: true,
    createdAt: new Date(),
    products: [],
    collections: [],
    storeCategories: [],
    categories: [],
    ...partial,
    value: partial.value as never,
    minOrderValue: (partial.minOrderValue ?? 0) as never,
  }
}

describe('scope matching', () => {
  it('empty scope matches everything', () => {
    expect(
      isScopeEmpty({
        productIds: [],
        collectionIds: [],
        storeCategoryIds: [],
        categories: [],
      }),
    ).toBe(true)
    expect(
      lineMatchesScope(line({ key: 'a', unitTotal: 100 }), {
        productIds: [],
        collectionIds: [],
        storeCategoryIds: [],
        categories: [],
      }),
    ).toBe(true)
  })

  it('matches product / category / collection / store category', () => {
    const l = line({
      key: 'a',
      unitTotal: 100,
      productId: 'p9',
      category: 'EARRINGS',
      collectionIds: ['c1'],
      storeCategoryIds: ['s1'],
    })
    expect(
      lineMatchesScope(l, {
        productIds: ['p9'],
        collectionIds: [],
        storeCategoryIds: [],
        categories: [],
      }),
    ).toBe(true)
    expect(
      lineMatchesScope(l, {
        productIds: [],
        collectionIds: [],
        storeCategoryIds: [],
        categories: ['EARRINGS'],
      }),
    ).toBe(true)
    expect(
      lineMatchesScope(l, {
        productIds: [],
        collectionIds: ['c1'],
        storeCategoryIds: [],
        categories: [],
      }),
    ).toBe(true)
    expect(
      lineMatchesScope(l, {
        productIds: ['other'],
        collectionIds: [],
        storeCategoryIds: [],
        categories: ['RINGS'],
      }),
    ).toBe(false)
  })
})

describe('computeStackedDiscounts', () => {
  it('applies auto % then coupon separately (never merges amounts)', () => {
    const result = computeStackedDiscounts(
      [line({ key: 'a', unitTotal: 10000, quantity: 1 })],
      [auto({ id: 'd1', name: 'Bridal', percent: 10, priority: 1 })],
      coupon({ id: 'c1', code: 'SAVE5', kind: 'PERCENT', value: 5 as never }),
    )
    expect(result.automatic).not.toBeNull()
    expect(result.coupon).not.toBeNull()
    expect(result.automatic!.amount).toBe(1000)
    expect(result.automatic!.percent).toBe(10)
    // coupon on remaining 9000 @ 5% = 450
    expect(result.coupon!.amount).toBe(450)
    expect(result.coupon!.percent).toBe(5)
    expect(result.discountAmount).toBe(1450)
    expect(result.breakdown.automatic?.amount).toBe(1000)
    expect(result.breakdown.coupon?.amount).toBe(450)
    expect(result.allocations[0]!.autoDiscount).toBe(1000)
    expect(result.allocations[0]!.couponDiscount).toBe(450)
    expect(result.allocations[0]!.payable).toBe(8550)
  })

  it('only discounts eligible lines for scoped auto + coupon', () => {
    const result = computeStackedDiscounts(
      [
        line({ key: 'ring', unitTotal: 10000, productId: 'p-ring', category: 'RINGS' }),
        line({ key: 'ear', unitTotal: 10000, productId: 'p-ear', category: 'EARRINGS' }),
      ],
      [
        auto({
          id: 'd1',
          name: 'Rings only',
          percent: 10,
          categories: [{ category: 'RINGS' }],
        }),
      ],
      coupon({
        id: 'c1',
        code: 'EAR10',
        kind: 'PERCENT',
        value: 10 as never,
        categories: [{ category: 'EARRINGS' }],
      }),
    )
    expect(result.automatic!.amount).toBe(1000)
    expect(result.coupon!.amount).toBe(1000)
    const ring = result.allocations.find((a) => a.key === 'ring')!
    const ear = result.allocations.find((a) => a.key === 'ear')!
    expect(ring.autoDiscount).toBe(1000)
    expect(ring.couponDiscount).toBe(0)
    expect(ear.autoDiscount).toBe(0)
    expect(ear.couponDiscount).toBe(1000)
  })

  it('picks higher priority auto rule per line', () => {
    const result = computeStackedDiscounts(
      [line({ key: 'a', unitTotal: 10000 })],
      [
        auto({ id: 'low', name: 'Low', percent: 20, priority: 1 }),
        auto({ id: 'high', name: 'High', percent: 5, priority: 10 }),
      ],
      null,
    )
    expect(result.automatic!.id).toBe('high')
    expect(result.automatic!.amount).toBe(500)
  })

  it('respects auto maxDiscount cap', () => {
    const result = computeStackedDiscounts(
      [line({ key: 'a', unitTotal: 100000 })],
      [auto({ id: 'd1', name: 'Capped', percent: 50, maxDiscount: 1000 })],
      null,
    )
    expect(result.automatic!.amount).toBe(1000)
  })

  it('stamps separate fields on snapshot', () => {
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
    const snap = toOrderItemPriceSnapshot(b, { goldRatePerGram: 6000, weightGrams: 5 })
    const stamped = applyDiscountToSnapshot(snap, {
      autoDiscount: 100,
      autoDiscountPercent: 10,
      autoDiscountLabel: 'Sale',
      couponDiscount: 50,
      couponDiscountPercent: 5,
      couponCode: 'SAVE5',
      couponKind: 'PERCENT',
      payable: Math.max(0, snap.total - 150),
    })
    expect(stamped.autoDiscount).toBe(100)
    expect(stamped.couponDiscount).toBe(50)
    expect(stamped.couponCode).toBe('SAVE5')
    expect(stamped.payable).toBe(Math.max(0, snap.total - 150))
    // formula fields unchanged
    expect(stamped.taxable).toBe(snap.taxable)
    expect(stamped.gst).toBe(snap.gst)
    expect(stamped.total).toBe(snap.total)
  })

  it('FREE_DELIVERY discounts delivery base only (capped by after-auto)', () => {
    const result = computeStackedDiscounts(
      [
        line({
          key: 'a',
          unitTotal: 10000,
          unitDeliveryInclGst: 200,
          unitMakingInclGst: 3000,
        }),
      ],
      [],
      coupon({ id: 'c1', code: 'FREEDEL', kind: 'FREE_DELIVERY', value: 0 as never }),
    )
    expect(result.coupon!.kind).toBe('FREE_DELIVERY')
    expect(result.coupon!.amount).toBe(200)
    expect(result.allocations[0]!.couponDiscount).toBe(200)
    expect(result.allocations[0]!.payable).toBe(9800)
  })

  it('MAKING_PERCENT is min of % of making and actual making', () => {
    const result = computeStackedDiscounts(
      [
        line({
          key: 'a',
          unitTotal: 20000,
          unitMakingInclGst: 4000,
          unitDeliveryInclGst: 100,
        }),
      ],
      [],
      coupon({ id: 'c1', code: 'MAKE50', kind: 'MAKING_PERCENT', value: 50 as never }),
    )
    expect(result.coupon!.amount).toBe(2000)
    expect(result.coupon!.percent).toBe(50)
  })

  it('MAKING_FLAT cannot exceed making base', () => {
    const result = computeStackedDiscounts(
      [
        line({
          key: 'a',
          unitTotal: 20000,
          unitMakingInclGst: 1500,
        }),
      ],
      [],
      coupon({ id: 'c1', code: 'MAKEFLAT', kind: 'MAKING_FLAT', value: 5000 as never }),
    )
    expect(result.coupon!.amount).toBe(1500)
  })

  it('MAKING_FLAT after auto is capped by remaining payable', () => {
    const result = computeStackedDiscounts(
      [
        line({
          key: 'a',
          unitTotal: 1000,
          unitMakingInclGst: 800,
        }),
      ],
      [auto({ id: 'd1', name: 'Deep', percent: 90 })],
      coupon({ id: 'c1', code: 'MAKEFLAT', kind: 'MAKING_FLAT', value: 800 as never }),
    )
    // after auto = 100; making coupon capped by afterAuto
    expect(result.automatic!.amount).toBe(900)
    expect(result.coupon!.amount).toBe(100)
  })
})

describe('componentInclGst / computeDiscount', () => {
  it('prorates GST onto a component', () => {
    // taxable 1000, gst 30, making 400 → 400 + 400/1000*30 = 412
    expect(componentInclGst(400, 1000, 30)).toBe(412)
  })

  it('FREE_DELIVERY uses delivery base', () => {
    expect(
      computeDiscount(
        { kind: 'FREE_DELIVERY', value: 0 as never, maxDiscount: null },
        { cartBase: 10000, makingBase: 3000, deliveryBase: 150 },
      ),
    ).toBe(150)
  })
})

