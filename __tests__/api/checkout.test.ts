import { NextRequest } from 'next/server'
import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/auth'
import { getPaymentGateway } from '@/lib/payments'
import { checkPincodeServiceability } from '@/lib/shipping/sequel247-validate'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    cartItem: { findMany: jest.fn().mockResolvedValue([]) },
    goldRate: { findMany: jest.fn().mockResolvedValue([]) },
    order: { create: jest.fn() },
    promoRedemption: { create: jest.fn() },
  },
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
})
