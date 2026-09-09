/**
 * @jest-environment node
 */
import { POST } from '@/app/api/admin/finance-digest/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/finance-digest', () => ({
  runFinanceDigest: jest.fn(async () => ({
    posted: true,
    content: 'ok',
    alerts: { pendingSheetsCount: 0, forReviewCount: 0, mismatches: [] },
  })),
}))

import { runFinanceDigest } from '@/lib/finance-digest'

const SECRET = 'test-finance-digest-secret'

function req(auth?: string) {
  return new NextRequest('http://localhost/api/admin/finance-digest', {
    method: 'POST',
    headers: auth ? { authorization: auth } : {},
  })
}

describe('POST /api/admin/finance-digest', () => {
  beforeEach(() => {
    process.env.FINANCE_DIGEST_SECRET = SECRET
    jest.clearAllMocks()
  })

  it('returns 401 without bearer', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(runFinanceDigest).not.toHaveBeenCalled()
  })

  it('returns 401 when secret unset', async () => {
    delete process.env.FINANCE_DIGEST_SECRET
    const res = await POST(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(401)
  })

  it('runs digest when authorised', async () => {
    const res = await POST(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    expect(runFinanceDigest).toHaveBeenCalled()
    await expect(res.json()).resolves.toMatchObject({ ok: true, posted: true })
  })
})
