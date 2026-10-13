import { NextRequest } from 'next/server'
import { GET } from '@/app/api/gold-rates/route'
import { POST } from '@/app/api/admin/sync-gold-rate/route'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    goldRate: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

const mockGoldRate = prisma.goldRate as jest.Mocked<typeof prisma.goldRate>

beforeEach(() => jest.clearAllMocks())

describe('GET /api/gold-rates', () => {
  it('returns all purity rates from DB', async () => {
    mockGoldRate.findMany.mockResolvedValue([
      {
        metalType: 'GOLD_18K',
        ratePerGram: 5100 as any,
        fetchedAt: new Date('2026-05-14T10:00:00Z'),
      },
      {
        metalType: 'GOLD_14K',
        ratePerGram: 3967 as any,
        fetchedAt: new Date('2026-05-14T10:00:00Z'),
      },
      {
        metalType: 'GOLD_22K',
        ratePerGram: 6233 as any,
        fetchedAt: new Date('2026-05-14T10:00:00Z'),
      },
      {
        metalType: 'GOLD_9K',
        ratePerGram: 2550 as any,
        fetchedAt: new Date('2026-05-14T10:00:00Z'),
      },
    ] as any)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.rates['18K']).toBe(5100)
    expect(data.rates['14K']).toBe(3967)
    expect(data.rates['22K']).toBe(6233)
    expect(data.rates['9K']).toBe(2550)
    expect(data.unit).toBe('₹/gram')
  })

  it('falls back to computed rates from 18K when rows missing', async () => {
    mockGoldRate.findMany.mockResolvedValue([
      {
        metalType: 'GOLD_18K',
        ratePerGram: 5400 as any,
        fetchedAt: new Date(),
      },
    ] as any)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.rates['18K']).toBe(5400)
    expect(data.rates['14K']).toBe(4200)
    expect(data.rates['22K']).toBe(6600)
    expect(data.rates['9K']).toBe(2700)
  })

  it('returns 503 when no 18K rate in DB', async () => {
    mockGoldRate.findMany.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(503)
  })
})

const SECRET = 'test-secret-123'
const makeReq = (authHeader?: string) =>
  new NextRequest('http://localhost/api/admin/sync-gold-rate', {
    method: 'POST',
    headers: authHeader ? { authorization: authHeader } : {},
  })

beforeEach(() => {
  process.env.GOLD_SYNC_SECRET = SECRET
  process.env.METAL_PRICE_API_KEY = 'test-api-key'
})

describe('POST /api/admin/sync-gold-rate — auth', () => {
  it('returns 401 with no auth header', async () => {
    const res = await POST(makeReq())
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong secret', async () => {
    const res = await POST(makeReq('Bearer wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns 401 when GOLD_SYNC_SECRET not set', async () => {
    delete process.env.GOLD_SYNC_SECRET
    const res = await POST(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/admin/sync-gold-rate — rate limiting', () => {
  it('returns 429 if synced less than 30 minutes ago', async () => {
    mockGoldRate.findUnique.mockResolvedValue({
      metalType: 'GOLD_18K',
      ratePerGram: 5100 as any,
      fetchedAt: new Date(Date.now() - 10 * 60 * 1000),
    } as any)

    const res = await POST(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toMatch(/Rate limited/)
  })

  it('allows sync when last sync was > 30 minutes ago', async () => {
    mockGoldRate.findUnique.mockResolvedValue({
      metalType: 'GOLD_18K',
      ratePerGram: 5100 as any,
      fetchedAt: new Date(Date.now() - 31 * 60 * 1000),
    } as any)

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, rates: { INR: 224000 } }),
    } as any)

    mockGoldRate.upsert.mockResolvedValue({} as any)

    const res = await POST(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.updated).toBe(true)
    expect(data.rates).toHaveProperty('18K')
    expect(data.rates).toHaveProperty('14K')
    expect(data.rates).toHaveProperty('22K')
    expect(data.rates).toHaveProperty('9K')
    expect(mockGoldRate.upsert).toHaveBeenCalledTimes(4)
  })
})

describe('POST /api/admin/sync-gold-rate — external API errors', () => {
  beforeEach(() => {
    mockGoldRate.findUnique.mockResolvedValue(null)
  })

  it('returns 502 when metal price API fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 } as any)
    const res = await POST(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(502)
  })

  it('returns 502 when API returns unexpected shape', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    } as any)
    const res = await POST(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(502)
  })

  it('returns 500 when METAL_PRICE_API_KEY not set', async () => {
    delete process.env.METAL_PRICE_API_KEY
    const res = await POST(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(500)
  })
})
