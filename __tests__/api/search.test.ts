import { GET } from '@/app/api/search/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
    },
    goldRate: {
      findMany: jest.fn(),
    },
    productTag: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    analyticsEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}))

jest.mock('@/lib/pricing-data', () => {
  const actual = jest.requireActual('@/lib/pricing-data')
  return {
    ...actual,
    getPricingConfig: jest.fn().mockResolvedValue({}),
    getShowPricesGlobal: jest.fn().mockResolvedValue(true),
  }
})

describe('GET /api/search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty results for queries under 2 characters', async () => {
    const req = new NextRequest('http://localhost:3000/api/search?q=a')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.results).toEqual([])
  })

  it('searches products with category matching and returns formatted results', async () => {
    ;(prisma.product.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'prod-1',
        name: 'Diamond Solitaire Ring',
        itemCode: 'RNG-01',
        category: 'RINGS',
        images: ['https://example.com/ring.jpg'],
        status: 'LIVE',
        isActive: true,
        variants: [
          {
            id: 'var-1',
            metalType: 'GOLD_18K',
            weightGrams: 3.5,
            makingChargePerGram: 300,
            flatMakingCharge: 0,
            stoneCharges: 0,
            miscCharges: 45,
            stock: 5,
          },
        ],
        stones: [],
      },
    ])
    ;(prisma.goldRate.findMany as jest.Mock).mockResolvedValue([
      { metalType: 'GOLD_18K', ratePerGram: 5000 },
    ])

    const req = new NextRequest('http://localhost:3000/api/search?q=rings')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.query).toBe('rings')
    expect(json.results).toHaveLength(1)
    expect(json.results[0].name).toBe('Diamond Solitaire Ring')
    expect(json.results[0].category).toBe('rings')
  })

  it('matches products tagged with category filter labels', async () => {
    ;(prisma.product.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'prod-sol-1',
        name: 'Classic Band',
        itemCode: 'RNG-02',
        category: 'RINGS',
        images: ['https://example.com/band.jpg'],
        status: 'LIVE',
        isActive: true,
        variants: [],
        stones: [],
      },
    ])
    ;(prisma.goldRate.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.productTag.findMany as jest.Mock).mockResolvedValueOnce([{ productId: 'prod-sol-1' }])

    const req = new NextRequest('http://localhost:3000/api/search?q=solitaire')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.results).toHaveLength(1)
    expect(json.results[0].id).toBe('prod-sol-1')

    const callArgs = (prisma.product.findMany as jest.Mock).mock.calls[0][0]
    expect(callArgs.where.OR).toEqual(
      expect.arrayContaining([{ id: { in: ['prod-sol-1'] } }])
    )
  })
})
