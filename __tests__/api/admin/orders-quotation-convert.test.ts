import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/orders/route'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import * as quotations from '@/lib/quotations'

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
    quotationEvent: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((cb) => cb(prisma)),
  },
}))
jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/split', () => ({ autoSplitOrder: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/quotations', () => ({
  ...jest.requireActual('@/lib/quotations'),
  closeThread: jest.fn(),
  notifyQuotationUpdate: jest.fn(),
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

describe('POST /api/admin/orders — quotation conversion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireAdmin as jest.Mock).mockResolvedValue({ user: { email: 'admin@thevairis.com', id: 'admin-1' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(prisma.productVariant.findMany as jest.Mock).mockResolvedValue([
      { id: 'v1', product: { name: 'Bracelet' } },
    ])
    // No metalType on the mocked variant above, so rateMap[v.metalType] is always undefined —
    // priceBreakdown calc is skipped regardless of these; just satisfying the route's fetch.
    ;(prisma.goldRate.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.pricingSettings.findUnique as jest.Mock).mockResolvedValue(null)
  })

  it('converts an ACCEPTED quotation and closes its thread', async () => {
    // The claim (updateMany) happens first now, before order.create — see
    // app/api/admin/orders/route.ts. Once it reports count: 1 the transaction re-reads the row
    // (now CONVERTED) to get discordThreadId, THEN creates the order, THEN links orderId back
    // onto the quotation with a plain update.
    ;(prisma.quotation.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.quotation.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: 'q1',
      displayId: 'Q-TEST',
      status: 'CONVERTED',
      discordThreadId: 'thread-1',
      details: null,
    })
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ discordThreadId: 'thread-1' })
    ;(prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-123', items: [{ id: 'item-1' }] })

    const res = await POST(req(baseBody({ quotationId: 'q1' })))
    expect(res.status).toBe(201)

    // Claim happens BEFORE order.create — assert the call order, not just that both were called.
    const updateManyOrder = (prisma.quotation.updateMany as jest.Mock).mock.invocationCallOrder[0]
    const orderCreateOrder = (prisma.order.create as jest.Mock).mock.invocationCallOrder[0]
    expect(updateManyOrder).toBeLessThan(orderCreateOrder)

    expect(prisma.quotation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'q1', status: 'ACCEPTED' },
        data: { status: 'CONVERTED' },
      }),
    )
    expect(prisma.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'q1' },
        data: { orderId: 'order-123' },
      }),
    )
    expect(quotations.notifyQuotationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'q1', discordThreadId: 'thread-1' }),
      expect.stringContaining('Converted'),
    )
    // Archive only — convert message already posted via notify (avoids duplicate thread posts).
    expect(quotations.closeThread).toHaveBeenCalledWith('thread-1')
  })

  it('409s and creates no order when the claim fails because the quotation is already CONVERTED', async () => {
    // The conditional updateMany (where status: 'ACCEPTED') matches 0 rows for a quotation that's
    // no longer ACCEPTED — this is now the ONLY status check; there's no separate unlocked read
    // beforehand to race against, which is exactly the fix (see route.ts comment).
    ;(prisma.quotation.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ status: 'CONVERTED' })

    const res = await POST(req(baseBody({ quotationId: 'q1' })))
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toMatch(/already converted or cancelled/i)
    expect(data.orderId).toBeUndefined()
    expect(prisma.quotation.findUniqueOrThrow).not.toHaveBeenCalled()
    expect(prisma.order.create).not.toHaveBeenCalled()
    expect(quotations.closeThread).not.toHaveBeenCalled()
  })

  it('409s and creates no order when the quotation is still QUOTED (not yet ACCEPTED)', async () => {
    // Same code path as the already-CONVERTED case: the where: { status: 'ACCEPTED' } clause on
    // the claim simply doesn't match a QUOTED row either, so count is 0.
    ;(prisma.quotation.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ status: 'QUOTED' })

    const res = await POST(req(baseBody({ quotationId: 'q1' })))
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toMatch(/ACCEPTED/i)
    expect(data.error).toMatch(/QUOTED/)
    expect(prisma.order.create).not.toHaveBeenCalled()
  })

  it('works unchanged with no quotationId at all', async () => {
    ;(prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-456', items: [{ id: 'item-1' }] })
    const res = await POST(req(baseBody()))
    expect(res.status).toBe(201)
    expect(prisma.quotation.updateMany).not.toHaveBeenCalled()
    expect(prisma.quotation.findUniqueOrThrow).not.toHaveBeenCalled()
    expect(prisma.quotation.update).not.toHaveBeenCalled()
    expect(quotations.closeThread).not.toHaveBeenCalled()
  })
})
