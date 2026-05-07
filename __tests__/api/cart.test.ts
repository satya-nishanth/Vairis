import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/cart/route'
import { PATCH, DELETE } from '@/app/api/cart/[itemId]/route'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    cartItem: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))
jest.mock('@/lib/auth', () => ({
  requireUser: jest.fn(),
}))
jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))

const mockCart = prisma.cartItem as jest.Mocked<typeof prisma.cartItem>
const mockRequireUser = requireUser as jest.MockedFunction<typeof requireUser>

const fakeUser = { id: 'user-1', email: 'test@test.com', name: 'Test', createdAt: new Date(), mobile: null, googleId: null, addresses: [], orders: [], cartItems: [] }

function makeReq(url: string, method = 'GET', body?: object) {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireUser.mockResolvedValue(fakeUser as any)
})

// ─── GET /api/cart ─────────────────────────────────────────────────────────

describe('GET /api/cart', () => {
  it('returns cart items for authenticated user', async () => {
    const items = [{ id: 'c1', userId: 'user-1', variantId: 'v1', quantity: 2 }]
    mockCart.findMany.mockResolvedValue(items as any)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('c1')
  })

  it('filters cart items by current user id', async () => {
    mockCart.findMany.mockResolvedValue([])
    await GET()
    expect(mockCart.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    )
  })

  it('includes variant and product in response', async () => {
    mockCart.findMany.mockResolvedValue([])
    await GET()
    expect(mockCart.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { variant: { include: { product: true } } },
      })
    )
  })

  it('returns empty array when cart is empty', async () => {
    mockCart.findMany.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('redirects when not authenticated', async () => {
    mockRequireUser.mockRejectedValue(new Error('REDIRECT:/auth/login'))
    await expect(GET()).rejects.toThrow('REDIRECT:/auth/login')
  })
})

// ─── POST /api/cart ────────────────────────────────────────────────────────

describe('POST /api/cart', () => {
  it('creates cart item and returns 201', async () => {
    const item = { id: 'c1', userId: 'user-1', variantId: 'v1', quantity: 1 }
    mockCart.upsert.mockResolvedValue(item as any)

    const req = makeReq('http://localhost/api/cart', 'POST', { variantId: 'v1', quantity: 1 })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('upserts with correct userId_variantId key', async () => {
    mockCart.upsert.mockResolvedValue({} as any)
    const req = makeReq('http://localhost/api/cart', 'POST', { variantId: 'v2', quantity: 3 })
    await POST(req)
    expect(mockCart.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_variantId: { userId: 'user-1', variantId: 'v2' } },
      })
    )
  })

  it('increments quantity on duplicate (upsert update clause)', async () => {
    mockCart.upsert.mockResolvedValue({} as any)
    const req = makeReq('http://localhost/api/cart', 'POST', { variantId: 'v1', quantity: 2 })
    await POST(req)
    expect(mockCart.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { quantity: { increment: 2 } },
        create: expect.objectContaining({ quantity: 2 }),
      })
    )
  })
})

// ─── PATCH /api/cart/[itemId] ─────────────────────────────────────────────

describe('PATCH /api/cart/[itemId]', () => {
  it('updates quantity and returns 200', async () => {
    mockCart.updateMany.mockResolvedValue({ count: 1 } as any)
    const req = makeReq('http://localhost/api/cart/c1', 'PATCH', { quantity: 5 })
    const res = await PATCH(req, { params: Promise.resolve({ itemId: 'c1' }) })
    expect(res.status).toBe(200)
  })

  it('scopes update to current user (prevents IDOR)', async () => {
    mockCart.updateMany.mockResolvedValue({ count: 1 } as any)
    const req = makeReq('http://localhost/api/cart/c1', 'PATCH', { quantity: 5 })
    await PATCH(req, { params: Promise.resolve({ itemId: 'c1' }) })
    expect(mockCart.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', userId: 'user-1' },
      data: { quantity: 5 },
    })
  })
})

// ─── DELETE /api/cart/[itemId] ────────────────────────────────────────────

describe('DELETE /api/cart/[itemId]', () => {
  it('returns 204 No Content', async () => {
    mockCart.deleteMany.mockResolvedValue({ count: 1 } as any)
    const req = makeReq('http://localhost/api/cart/c1', 'DELETE')
    const res = await DELETE(req, { params: Promise.resolve({ itemId: 'c1' }) })
    expect(res.status).toBe(204)
  })

  it('scopes delete to current user (prevents IDOR)', async () => {
    mockCart.deleteMany.mockResolvedValue({ count: 1 } as any)
    const req = makeReq('http://localhost/api/cart/c1', 'DELETE')
    await DELETE(req, { params: Promise.resolve({ itemId: 'c1' }) })
    expect(mockCart.deleteMany).toHaveBeenCalledWith({
      where: { id: 'c1', userId: 'user-1' },
    })
  })
})
