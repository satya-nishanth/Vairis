import { NextRequest } from 'next/server'
import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/auth'
import { getPaymentGateway } from '@/lib/payments'
import { checkPincodeServiceability } from '@/lib/shipping/sequel247-validate'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    cartItem: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    goldRate: { findMany: jest.fn().mockResolvedValue([]) },
    order: { create: jest.fn(), update: jest.fn() },
    promoRedemption: { create: jest.fn(), deleteMany: jest.fn() },
    payment: { create: jest.fn() },
    automaticDiscount: { findMany: jest.fn().mockResolvedValue([]) },
    collectionProduct: { findMany: jest.fn().mockResolvedValue([]) },
    storeCategoryProduct: { findMany: jest.fn().mockResolvedValue([]) },
    promoCode: { findUnique: jest.fn().mockResolvedValue(null) },
  },
}))
jest.mock('@/lib/product-piece-pricing', () => ({
  toSetOrderItemSnapshot: jest.fn().mockReturnValue({
    goldValue: 30000,
    goldVA: 3000,
    making: 500,
    stoneValue: 0,
    diamondValue: 0,
    otherStoneValue: 0,
    stoneLines: [],
    stoneVA: 0,
    vaTotal: 3000,
    vaLabel: 'Value Addition',
    miscCharges: 0,
    taxable: 33500,
    gst: 1005,
    total: 34505,
    withExchange: false,
    goldRatePerGram: 6000,
    weightGrams: 5,
    capturedAt: new Date().toISOString(),
  }),
}))
jest.mock('@/lib/auth', () => ({ getAppUser: jest.fn() }))
jest.mock('@/lib/payments', () => ({ getPaymentGateway: jest.fn() }))
jest.mock('@/lib/shipping/sequel247-validate', () => ({ checkPincodeServiceability: jest.fn() }))
jest.mock('@/lib/pricing-data', () => ({
  getPricingConfig: jest.fn().mockResolvedValue({}),
  toStoneInputs: jest.fn().mockReturnValue([]),
}))

const mockGetAppUser = getAppUser as jest.MockedFunction<typeof getAppUser>
const mockGetGateway = getPaymentGateway as jest.MockedFunction<typeof getPaymentGateway>
const mockCheck = checkPincodeServiceability as jest.MockedFunction<typeof checkPincodeServiceability>

function req(body: unknown) {
  return new NextRequest('http://localhost/api/checkout', { method: 'POST', body: JSON.stringify(body) })
}

const indiaAddress = {
  contactName: 'Surya Teja',
  contactPhone: '9876543210',
  addressLine1: 'Flat 101, Some Building',
  city: 'Hyderabad',
  state: 'Telangana',
  pincode: '502300',
}

const usAddress = {
  contactName: 'Jane Doe',
  contactPhone: '+1-415-555-0199',
  addressLine1: '1 Market Street, Suite 400',
  city: 'San Francisco',
  state: 'California',
  pincode: '94105',
  country: 'United States',
}

// Minimal cart item shape that lets calculatePrice() (lib/pricing.ts) run
// without throwing: variant.metalType must have a matching goldRate entry,
// and weightGrams/makingChargePerGram/flatMakingCharge/stoneCharges/
// miscCharges just need to be Number()-able (calls .toString() on each).
const cartItemFixture = {
  id: 'ci1',
  variantId: 'v1',
  quantity: 1,
  withExchange: false,
  variant: {
    metalType: 'GOLD_22K',
    metalColor: 'YELLOW',
    weightGrams: 5,
    makingChargePerGram: 100,
    flatMakingCharge: 0,
    stoneCharges: 0,
    miscCharges: 0,
    product: {
      id: 'p1',
      name: 'Test Ring',
      category: 'RINGS',
      stones: [],
      pieces: [],
      variants: [],
      vaGoldPct: null,
      vaLabel: null,
    },
  },
}
const goldRateFixture = [{ metalType: 'GOLD_22K', ratePerGram: 6000 }]

describe('POST /api/checkout — address handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAppUser.mockResolvedValue({ id: 'u1' } as never)
    mockGetGateway.mockReturnValue({ isConfigured: () => true, name: 'mock' } as never)
  })

  it('returns EMPTY_CART before touching the address when cart is empty', async () => {
    const res = await checkout(req(indiaAddress))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('EMPTY_CART')
  })

  it('rejects an unserviceable India pincode without creating an order', async () => {
    ;(prisma.cartItem.findMany as jest.Mock).mockResolvedValue([{ id: 'ci1' }])
    mockCheck.mockResolvedValue({ ok: false, reason: 'not_found' })
    const res = await checkout(req(indiaAddress))
    expect(res.status).toBe(400)
    expect(prisma.order.create).not.toHaveBeenCalled()
  })

  it('creates a non-IN order with intlReviewRequired and skips Sequel247 entirely', async () => {
    ;(prisma.cartItem.findMany as jest.Mock).mockResolvedValue([cartItemFixture])
    ;(prisma.goldRate.findMany as jest.Mock).mockResolvedValue(goldRateFixture)
    ;(prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order1' })
    ;(prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'pay1' })
    ;(prisma.cartItem.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
    mockGetGateway.mockReturnValue({
      isConfigured: () => true,
      name: 'mock',
      createPaymentIntent: jest.fn().mockResolvedValue({ gatewayOrderId: 'pi_1', clientParams: {} }),
    } as never)

    const res = await checkout(req(usAddress))

    expect(res.status).toBe(200)
    expect(mockCheck).not.toHaveBeenCalled()
    // STG-44: the bag stays until payment is captured.
    expect(prisma.cartItem.deleteMany).not.toHaveBeenCalled()
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          country: 'United States',
          intlReviewRequired: true,
        }),
      }),
    )
  })
})
