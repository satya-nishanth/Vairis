import { NextRequest } from 'next/server'
import { GET } from '@/app/api/internal/quotations/route'
import { PATCH } from '@/app/api/internal/quotations/[id]/route'
import { prisma } from '@/lib/prisma'
import * as quotations from '@/lib/quotations'

jest.mock('@/lib/prisma', () => ({
  prisma: { quotation: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() } },
}))
jest.mock('@/lib/quotations', () => ({
  ...jest.requireActual('@/lib/quotations'),
  createQuoteThread: jest.fn(),
  postToThread: jest.fn(),
  mentionAssignee: jest.fn(() => '<@assignee>'),
}))

function authedReq(url: string, init: RequestInit = {}) {
  return new NextRequest(url, { ...init, headers: { ...init.headers, authorization: 'Bearer test-internal-key' } })
}

beforeAll(() => {
  process.env.INTERNAL_API_KEY = 'test-internal-key'
})

describe('GET /api/internal/quotations', () => {
  it('401s without a valid Bearer token', async () => {
    const res = await GET(new NextRequest('http://localhost/api/internal/quotations'))
    expect(res.status).toBe(401)
  })

  it('returns open quotations with the fields the bot needs', async () => {
    ;(prisma.quotation.findMany as jest.Mock).mockResolvedValue([{ id: 'q1', status: 'REQUESTED' }])
    const res = await GET(authedReq('http://localhost/api/internal/quotations'))
    expect(res.status).toBe(200)
    expect(prisma.quotation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ['REQUESTED', 'QUOTED'] } } }),
    )
  })
})

describe('PATCH /api/internal/quotations/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  function patchReq(body: unknown) {
    return authedReq('http://localhost/api/internal/quotations/q1', { method: 'PATCH', body: JSON.stringify(body) })
  }

  it('401s without a valid Bearer token', async () => {
    const res = await PATCH(
      new NextRequest('http://localhost/x', { method: 'PATCH', body: '{}' }),
      { params: Promise.resolve({ id: 'q1' }) },
    )
    expect(res.status).toBe(401)
  })

  it('writes back reminder bookkeeping fields', async () => {
    ;(prisma.quotation.update as jest.Mock).mockResolvedValue({ id: 'q1' })
    const res = await PATCH(
      patchReq({ lastReminderAt: new Date().toISOString(), reminderCount: 2 }),
      { params: Promise.resolve({ id: 'q1' }) },
    )
    expect(res.status).toBe(200)
    expect(prisma.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reminderCount: 2 }) }),
    )
  })

  it('rejects status: QUOTED when the current status forbids it', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'CONVERTED', discordThreadId: null })
    const res = await PATCH(patchReq({ status: 'QUOTED' }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(409)
  })

  it('retryThread creates a thread when discordThreadId is missing', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', displayId: 'Q-ABCD', status: 'REQUESTED', discordThreadId: null })
    ;(quotations.createQuoteThread as jest.Mock).mockResolvedValue('thread-new')
    ;(prisma.quotation.update as jest.Mock).mockResolvedValue({ id: 'q1', discordThreadId: 'thread-new' })
    const res = await PATCH(patchReq({ retryThread: true }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(200)
    expect(quotations.createQuoteThread).toHaveBeenCalled()
    expect(prisma.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ discordThreadId: 'thread-new' }) }),
    )
  })

  it('retryThread is a no-op when a discordThreadId already exists', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'REQUESTED', discordThreadId: 'thread-existing' })
    ;(prisma.quotation.update as jest.Mock).mockResolvedValue({ id: 'q1', discordThreadId: 'thread-existing' })
    const res = await PATCH(patchReq({ retryThread: true }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(200)
    expect(quotations.createQuoteThread).not.toHaveBeenCalled()
  })

  it('allows an idempotent QUOTED status PATCH when already QUOTED (re-quoting)', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'QUOTED', discordThreadId: 'thread-1' })
    ;(prisma.quotation.update as jest.Mock).mockResolvedValue({ id: 'q1', status: 'QUOTED' })
    const res = await PATCH(patchReq({ status: 'QUOTED', quotedAmount: 60000 }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(200)
  })
})
