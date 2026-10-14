import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/orders/route'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    productVariant: { findMany: jest.fn() },
    goldRate: { findMany: jest.fn() },
    pricingSettings: { findUnique: jest.fn() },
    order: { create: jest.fn() },
    quotation: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(prisma)),
  },
}))
jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/split', () => ({ autoSplitOrder: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/quotations', () => ({
  ...jest.requireActual('@/lib/quotations'),
  closeThread: jest.fn(),
}))

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    contactName: 'Asha',
    contactPhone: '9876543210',
    addressLine1: '1 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    initialStatus: 'PAYMENT_PENDING',
    items: [{ variantId: 'v1', quantity: 1, unitPrice: 45000 }],
    ...overrides,
  }
}

function req(body: unknown) {
  return new NextRequest('http://localhost/api/admin/orders', { method: 'POST', body: JSON.stringify(body) })
}

describe('POST /api/admin/orders — sellingBreakdown validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireAdmin as jest.Mock).mockResolvedValue({ user: { email: 'admin@thevairis.com', id: 'admin-1' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(prisma.productVariant.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'v1',
        product: { name: 'Bracelet', stones: [], pieces: [], variants: [{ id: 'v1' }] },
        metalType: 'GOLD_22K',
        weightGrams: 5,
        makingChargePerGram: 500,
        flatMakingCharge: 0,
        stoneCharges: 0,
        miscCharges: 0,
      },
    ])
    ;(prisma.goldRate.findMany as jest.Mock).mockResolvedValue([{ metalType: 'GOLD_22K', ratePerGram: 6000 }])
    ;(prisma.pricingSettings.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-123', items: [{ id: 'item-1' }] })
  })

  it('rejects when sellingBreakdown total does not match goods total', async () => {
    const res = await POST(
      req(
        baseBody({
          items: [{ variantId: 'v1', quantity: 1, unitPrice: 45000 }],
          sellingBreakdown: {
            gold: 30000,
            diamonds: 0,
            stones: 0,
            making: 5000,
            wastage: 0,
            delivery: 0,
            gst: 0,
          }, // sums to 35000, not 45000
        }),
      ),
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/doesn't match goods total/)
    expect(prisma.order.create).not.toHaveBeenCalled()
  })

  it('accepts when sellingBreakdown total matches goods total', async () => {
    const res = await POST(
      req(
        baseBody({
          items: [{ variantId: 'v1', quantity: 1, unitPrice: 45000 }],
          sellingBreakdown: {
            gold: 30000,
            diamonds: 0,
            stones: 0,
            making: 5000,
            wastage: 5000,
            delivery: 0,
            gst: 5000,
          }, // sums to 45000
        }),
      ),
    )
    expect(res.status).toBe(201)
    expect(prisma.order.create).toHaveBeenCalled()
  })

  it('accepts when gross minus discount matches goods total', async () => {
    const res = await POST(
      req(
        baseBody({
          items: [{ variantId: 'v1', quantity: 1, unitPrice: 44000 }],
          sellingBreakdown: {
            gold: 30000,
            diamonds: 0,
            stones: 0,
            making: 5000,
            wastage: 5000,
            delivery: 0,
            gst: 5000,
            discount: 1000,
          }, // 45000 − 1000 = 44000
        }),
      ),
    )
    expect(res.status).toBe(201)
    expect(prisma.order.create).toHaveBeenCalled()
    const createArg = (prisma.order.create as jest.Mock).mock.calls[0][0]
    expect(createArg.data.discountAmount).toBe(1000)
  })

  it('rejects create when discount is set but unit prices are still pre-discount (gross)', async () => {
    const res = await POST(
      req(
        baseBody({
          items: [{ variantId: 'v1', quantity: 1, unitPrice: 45000 }],
          sellingBreakdown: {
            gold: 30000,
            diamonds: 0,
            stones: 0,
            making: 5000,
            wastage: 5000,
            delivery: 0,
            gst: 5000,
            discount: 1000,
          }, // gross === goods; would overcharge if accepted
        }),
      ),
    )
    expect(res.status).toBe(400)
    expect(prisma.order.create).not.toHaveBeenCalled()
  })

  it('allows omitting sellingBreakdown entirely', async () => {
    const res = await POST(req(baseBody()))
    expect(res.status).toBe(201)
    expect(prisma.order.create).toHaveBeenCalled()
  })
})
