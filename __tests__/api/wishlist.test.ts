import { NextRequest } from 'next/server'
import { GET, POST, DELETE } from '@/app/api/wishlist/route'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/auth'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    wishlist: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
  },
}))
jest.mock('@/lib/auth', () => ({
  getAppUser: jest.fn(),
}))
jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))

const mockWishlist = prisma.wishlist as jest.Mocked<typeof prisma.wishlist>
const mockProduct = prisma.product as jest.Mocked<typeof prisma.product>
const mockGetAppUser = getAppUser as jest.MockedFunction<typeof getAppUser>

const fakeUser = { id: 'user-1', email: 'user@test.com', name: 'Test' }
const comingSoonProduct = { id: 'p1', comingSoon: true }
const regularProduct = { id: 'p2', comingSoon: false }

function makeReq(url: string, method = 'GET', body?: object) {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetAppUser.mockResolvedValue(fakeUser as any)
})

// ─── GET /api/wishlist ─────────────────────────────────────────────────────

describe('GET /api/wishlist', () => {
  it('returns wishlist items for current user', async () => {
    const items = [{ id: 'w1', userId: 'user-1', productId: 'p1', product: comingSoonProduct }]
    mockWishlist.findMany.mockResolvedValue(items as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
  })

  it('scopes query to current user', async () => {
    mockWishlist.findMany.mockResolvedValue([])
    await GET()
    expect(mockWishlist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    )
  })

  it('returns 401 when not authenticated', async () => {
    mockGetAppUser.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })
})

// ─── POST /api/wishlist ────────────────────────────────────────────────────

describe('POST /api/wishlist', () => {
  it('adds a coming-soon product to wishlist', async () => {
    mockProduct.findUnique.mockResolvedValue(comingSoonProduct as any)
    mockWishlist.upsert.mockResolvedValue({ id: 'w1', userId: 'user-1', productId: 'p1' } as any)

    const req = makeReq('http://localhost/api/wishlist', 'POST', { productId: 'p1' })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('upserts so duplicate adds are idempotent', async () => {
    mockProduct.findUnique.mockResolvedValue(comingSoonProduct as any)
    mockWishlist.upsert.mockResolvedValue({ id: 'w1' } as any)
    const req = makeReq('http://localhost/api/wishlist', 'POST', { productId: 'p1' })
    await POST(req)
    expect(mockWishlist.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_productId: { userId: 'user-1', productId: 'p1' } },
        create: expect.objectContaining({ userId: 'user-1', productId: 'p1' }),
      })
    )
  })

  it('returns 400 when productId is missing', async () => {
    const req = makeReq('http://localhost/api/wishlist', 'POST', {})
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 when product does not exist', async () => {
    mockProduct.findUnique.mockResolvedValue(null)
    const req = makeReq('http://localhost/api/wishlist', 'POST', { productId: 'bad-id' })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it.skip('returns 400 when product is NOT coming soon (removed restriction)', async () => {
    mockProduct.findUnique.mockResolvedValue(regularProduct as any)
    const req = makeReq('http://localhost/api/wishlist', 'POST', { productId: 'p2' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/coming-soon/i)
  })

  it('requires authentication', async () => {
    mockGetAppUser.mockResolvedValue(null)
    const req = makeReq('http://localhost/api/wishlist', 'POST', { productId: 'p1' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(mockWishlist.upsert).not.toHaveBeenCalled()
  })
})

// ─── DELETE /api/wishlist ──────────────────────────────────────────────────

describe('DELETE /api/wishlist', () => {
  it('removes product from wishlist and returns 204', async () => {
    mockWishlist.deleteMany.mockResolvedValue({ count: 1 } as any)
    const req = makeReq('http://localhost/api/wishlist?productId=p1', 'DELETE')
    const res = await DELETE(req)
    expect(res.status).toBe(204)
  })

  it('scopes delete to current user (prevents IDOR)', async () => {
    mockWishlist.deleteMany.mockResolvedValue({ count: 1 } as any)
    const req = makeReq('http://localhost/api/wishlist?productId=p1', 'DELETE')
    await DELETE(req)
    expect(mockWishlist.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', productId: 'p1' },
    })
  })

  it('returns 400 when productId is missing', async () => {
    const req = makeReq('http://localhost/api/wishlist', 'DELETE')
    const res = await DELETE(req)
    expect(res.status).toBe(400)
  })
})
