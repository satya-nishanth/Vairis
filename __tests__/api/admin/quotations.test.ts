import { NextRequest } from 'next/server'
import { POST, GET } from '@/app/api/admin/quotations/route'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import * as quotations from '@/lib/quotations'

jest.mock('@/lib/prisma', () => ({
  prisma: { quotation: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() } },
}))
jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/quotations', () => ({
  ...jest.requireActual('@/lib/quotations'),
  createQuoteThread: jest.fn().mockResolvedValue('thread-1'),
  postToThread: jest.fn(),
  mentionAssignee: jest.fn(() => '<@assignee>'),
}))

function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/admin/quotations', { method: 'POST', body: JSON.stringify(body) })
}
function getReq(query: string) {
  return new NextRequest(`http://localhost/api/admin/quotations${query}`)
}

describe('POST /api/admin/quotations', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects a request with no orderType', async () => {
    const res = await POST(postReq({ details: 'Kurnool bracelet quotation' }))
    expect(res.status).toBe(400)
  })

  it('creates a REQUESTED MANUAL quotation with the given orderType', async () => {
    ;(prisma.quotation.create as jest.Mock).mockResolvedValue({
      id: 'q1', displayId: 'Q-ABCD', discordThreadId: null,
    })
    const res = await POST(postReq({ orderType: 'CUSTOMISATION', details: 'Kurnool bracelet quotation' }))
    expect(res.status).toBe(201)
    expect(prisma.quotation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: 'MANUAL', orderType: 'CUSTOMISATION' }) }),
    )
    expect(requireAdmin).toHaveBeenCalled()
  })
})

describe('GET /api/admin/quotations', () => {
  beforeEach(() => jest.clearAllMocks())

  it('defaults to oldest-createdAt-first with no filter', async () => {
    ;(prisma.quotation.findMany as jest.Mock).mockResolvedValue([])
    await GET(getReq(''))
    expect(prisma.quotation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
    )
  })

  it('sorts by quotedAt when filtering to QUOTED', async () => {
    ;(prisma.quotation.findMany as jest.Mock).mockResolvedValue([])
    await GET(getReq('?status=QUOTED'))
    expect(prisma.quotation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'QUOTED' }, orderBy: { quotedAt: 'asc' } }),
    )
  })

  it('?attention=true filters to escalated REQUESTED or stale QUOTED', async () => {
    ;(prisma.quotation.findMany as jest.Mock).mockResolvedValue([])
    await GET(getReq('?attention=true'))
    const call = (prisma.quotation.findMany as jest.Mock).mock.calls[0][0]
    expect(call.where.OR).toHaveLength(2)
    expect(call.where.OR[0]).toEqual({ status: 'REQUESTED', escalatedAt: { not: null } })
    expect(call.where.OR[1].status).toBe('QUOTED')
    expect(call.where.OR[1].quotedAt.lt).toBeInstanceOf(Date)
  })
})
