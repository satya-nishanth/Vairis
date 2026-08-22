import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/orders/route'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import * as quotations from '@/lib/quotations'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    productVariant: { findMany: jest.fn() },
    order: { create: jest.fn() },
    quotation: { findUnique: jest.fn(), update: jest.fn() },
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

describe('POST /api/admin/orders — quotation conversion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(prisma.productVariant.findMany as jest.Mock).mockResolvedValue([
      { id: 'v1', product: { name: 'Bracelet' } },
    ])
  })

  it('converts a QUOTED quotation and closes its thread', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({
      id: 'q1', status: 'QUOTED', discordThreadId: 'thread-1',
    })
    ;(prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-123' })

    const res = await POST(req(baseBody({ quotationId: 'q1' })))
    expect(res.status).toBe(201)
    expect(prisma.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'q1' }, data: { status: 'CONVERTED', orderId: 'order-123' } }),
    )
    expect(quotations.closeThread).toHaveBeenCalledWith('thread-1', expect.stringContaining('order-123'.slice(-8)))
  })

  it('409s and creates no order when the quotation is already CONVERTED', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'CONVERTED', discordThreadId: null })
    const res = await POST(req(baseBody({ quotationId: 'q1' })))
    expect(res.status).toBe(409)
    expect(prisma.order.create).not.toHaveBeenCalled()
  })

  it('409s when the quotation is still REQUESTED (not yet QUOTED)', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'REQUESTED', discordThreadId: null })
    const res = await POST(req(baseBody({ quotationId: 'q1' })))
    expect(res.status).toBe(409)
    expect(prisma.order.create).not.toHaveBeenCalled()
  })

  it('works unchanged with no quotationId at all', async () => {
    ;(prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-456' })
    const res = await POST(req(baseBody()))
    expect(res.status).toBe(201)
    expect(prisma.quotation.findUnique).not.toHaveBeenCalled()
    expect(quotations.closeThread).not.toHaveBeenCalled()
  })
})
