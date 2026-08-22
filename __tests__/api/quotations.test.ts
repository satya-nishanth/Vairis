import { NextRequest } from 'next/server'
import { POST } from '@/app/api/quotations/route'
import { prisma } from '@/lib/prisma'
import * as quotations from '@/lib/quotations'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    quotation: { create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn((cb) => cb(prisma)),
    $queryRaw: jest.fn(),
  },
}))
jest.mock('@/lib/quotations', () => ({
  ...jest.requireActual('@/lib/quotations'),
  createQuoteThread: jest.fn(),
  postToThread: jest.fn(),
  mentionAssignee: jest.fn(() => '<@assignee>'),
}))

const mockPrisma = prisma as unknown as {
  quotation: { create: jest.Mock; update: jest.Mock }
  $queryRaw: jest.Mock
}

function req(body: unknown) {
  return new NextRequest('http://localhost/api/quotations', { method: 'POST', body: JSON.stringify(body) })
}

describe('POST /api/quotations', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects a request with no customerMobile', async () => {
    const res = await POST(req({ customerName: 'Asha' }))
    expect(res.status).toBe(400)
  })

  it('creates a REQUESTED VAIRIS quotation, ignoring a client-supplied orderType', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])
    mockPrisma.quotation.create.mockResolvedValue({
      id: 'q1', displayId: 'Q-ABCD', status: 'REQUESTED', customerMobile: '919876543210', discordThreadId: null,
    })
    ;(quotations.createQuoteThread as jest.Mock).mockResolvedValue('thread-1')

    const res = await POST(req({
      customerName: 'Asha', customerMobile: '919876543210', orderType: 'CUSTOMISATION',
    }))
    expect(res.status).toBe(201)
    expect(mockPrisma.quotation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderType: 'VAIRIS', source: 'WEBSITE' }) }),
    )
  })

  it('reuses an existing open quotation for the same mobile instead of creating a duplicate', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 'existing-1' }])
    ;(prisma as any).quotation.findUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'existing-1', displayId: 'Q-EXST', status: 'REQUESTED', customerMobile: '919876543210', discordThreadId: 'thread-old',
    })

    const res = await POST(req({ customerName: 'Asha', customerMobile: '919876543210' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('existing-1')
    expect(mockPrisma.quotation.create).not.toHaveBeenCalled()
  })

  it('still returns 201 when Discord thread creation fails', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])
    mockPrisma.quotation.create.mockResolvedValue({
      id: 'q2', displayId: 'Q-FAIL', status: 'REQUESTED', customerMobile: '919876543211', discordThreadId: null,
    })
    ;(quotations.createQuoteThread as jest.Mock).mockRejectedValue(new Error('Discord down'))

    const res = await POST(req({ customerName: 'Asha', customerMobile: '919876543211' }))
    expect(res.status).toBe(201)
  })
})
