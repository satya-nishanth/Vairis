import { NextRequest } from 'next/server'
import { GET, PATCH } from '@/app/api/admin/quotations/[id]/route'
import { prisma } from '@/lib/prisma'
import * as quotations from '@/lib/quotations'

jest.mock('@/lib/prisma', () => ({
  prisma: { quotation: { findUnique: jest.fn(), update: jest.fn() } },
}))
jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/quotations', () => ({
  ...jest.requireActual('@/lib/quotations'),
  closeThread: jest.fn(),
}))

function patchReq(body: unknown) {
  return new NextRequest('http://localhost/api/admin/quotations/q1', { method: 'PATCH', body: JSON.stringify(body) })
}

describe('GET /api/admin/quotations/[id]', () => {
  it('404s on an unknown id', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/admin/quotations/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('mark_quoted is rejected from a terminal status', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'CONVERTED', discordThreadId: null })
    const res = await PATCH(patchReq({ action: 'mark_quoted' }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(409)
    expect(prisma.quotation.update).not.toHaveBeenCalled()
  })

  it('mark_quoted sets QUOTED + quotedAt + optional amount/notes', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'REQUESTED', discordThreadId: null })
    ;(prisma.quotation.update as jest.Mock).mockResolvedValue({ id: 'q1', status: 'QUOTED', discordThreadId: null })
    const res = await PATCH(
      patchReq({ action: 'mark_quoted', quotedAmount: 45000, quotedNotes: 'Discussed at the store' }),
      { params: Promise.resolve({ id: 'q1' }) },
    )
    expect(res.status).toBe(200)
    expect(prisma.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'QUOTED', quotedAmount: 45000, quotedNotes: 'Discussed at the store' }),
      }),
    )
  })

  it('mark_quoted can be called again while still QUOTED to overwrite amount/notes', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'QUOTED', discordThreadId: null })
    ;(prisma.quotation.update as jest.Mock).mockResolvedValue({ id: 'q1', status: 'QUOTED', discordThreadId: null })
    const res = await PATCH(patchReq({ action: 'mark_quoted', quotedAmount: 50000 }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(200)
    expect(prisma.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'QUOTED', quotedAmount: 50000 }) }),
    )
  })

  it('cancel closes the Discord thread when one exists', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'REQUESTED', discordThreadId: 'thread-1' })
    ;(prisma.quotation.update as jest.Mock).mockResolvedValue({ id: 'q1', status: 'CANCELLED', discordThreadId: 'thread-1' })
    const res = await PATCH(patchReq({ action: 'cancel' }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(200)
    expect(quotations.closeThread).toHaveBeenCalledWith('thread-1', expect.stringContaining('Cancelled'))
  })

  it('cancel is rejected from a terminal status', async () => {
    ;(prisma.quotation.findUnique as jest.Mock).mockResolvedValue({ id: 'q1', status: 'CONVERTED', discordThreadId: null })
    const res = await PATCH(patchReq({ action: 'cancel' }), { params: Promise.resolve({ id: 'q1' }) })
    expect(res.status).toBe(409)
  })
})
