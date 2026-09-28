import { NextRequest } from 'next/server'
import { GET as getProducts } from '@/app/api/products/route'
import { GET as getProduct } from '@/app/api/products/[id]/route'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    goldRate: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    pricingSettings: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  },
}))

const mockProduct = prisma.product as jest.Mocked<typeof prisma.product>

beforeEach(() => jest.clearAllMocks())

const makeReq = (url: string) => new NextRequest(new URL(url, 'http://localhost'))

describe('GET /api/products', () => {
  it('returns all active products', async () => {
    mockProduct.findMany.mockResolvedValue([
      { id: 'p1', name: 'Ring', category: 'RINGS', images: [], isActive: true, variants: [] } as any,
    ])
    const res = await getProducts(makeReq('http://localhost/api/products'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].name).toBe('Ring')
  })

  it('passes category filter to prisma', async () => {
    mockProduct.findMany.mockResolvedValue([])
    await getProducts(makeReq('http://localhost/api/products?category=RINGS'))
    expect(mockProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'RINGS' }),
      })
    )
  })

  it('passes search filter', async () => {
    mockProduct.findMany.mockResolvedValue([])
    await getProducts(makeReq('http://localhost/api/products?search=heart'))
    expect(mockProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: expect.objectContaining({ contains: 'heart' }) }),
          ]),
        }),
      })
    )
  })
})

describe('GET /api/products/[id]', () => {
  it('returns product when found', async () => {
    mockProduct.findUnique.mockResolvedValue({
      id: 'p1', name: 'Bracelet', category: 'BRACELETS', images: [], isActive: true, variants: [],
    } as any)
    const res = await getProduct(makeReq('http://localhost/api/products/p1'), {
      params: Promise.resolve({ id: 'p1' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('Bracelet')
  })

  it('returns 404 when not found', async () => {
    mockProduct.findUnique.mockResolvedValue(null)
    const res = await getProduct(makeReq('http://localhost/api/products/x'), {
      params: Promise.resolve({ id: 'x' }),
    })
    expect(res.status).toBe(404)
  })
})
