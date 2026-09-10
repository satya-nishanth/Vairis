import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/cart/route'
import { PATCH, DELETE } from '@/app/api/cart/[itemId]/route'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/auth'
import { getPricingConfig, getShowPricesGlobal, resolvePriceVisibility } from '@/lib/pricing-data'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    cartItem: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    goldRate: {
      findMany: jest.fn(),
    },
    productVariant: {
      findUnique: jest.fn(),
    },
  },
}))
jest.mock('@/lib/auth', () => ({
  getAppUser: jest.fn(),
}))
jest.mock('@/lib/pricing-data', () => ({
  getPricingConfig: jest.fn(),
  getShowPricesGlobal: jest.fn(),
  resolvePriceVisibility: jest.fn(),
  toStoneInputs: jest.fn().mockReturnValue([]),
}))
jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))

const mockCart = prisma.cartItem as jest.Mocked<typeof prisma.cartItem>
const mockGoldRate = prisma.goldRate as jest.Mocked<typeof prisma.goldRate>
const mockVariant = prisma.productVariant as jest.Mocked<typeof prisma.productVariant>
const mockGetAppUser = getAppUser as jest.MockedFunction<typeof getAppUser>
const mockGetPricingConfig = getPricingConfig as jest.MockedFunction<typeof getPricingConfig>
const mockGetShowPricesGlobal = getShowPricesGlobal as jest.MockedFunction<typeof getShowPricesGlobal>
const mockResolvePriceVisibility = resolvePriceVisibility as jest.MockedFunction<typeof resolvePriceVisibility>

const fakeUser = { id: 'user-1', email: 'test@test.com', name: 'Test', createdAt: new Date(), mobile: null, googleId: null, addresses: [], orders: [], cartItems: [] }

const fakeCartItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  userId: 'user-1',
  variantId: 'v1',
  quantity: 2,
  withExchange: false,
  variant: {
    weightGrams: '5',
    makingChargePerGram: '100',
    flatMakingCharge: '0',
    stoneCharges: '0',
    miscCharges: '0',
    metalType: 'GOLD_18K',
    product: { stones: [] },
  },
  ...overrides,
})

function makeReq(url: string, method = 'GET', body?: object) {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetAppUser.mockResolvedValue(fakeUser as any)
  mockGoldRate.findMany.mockResolvedValue([{ metalType: 'GOLD_18K', ratePerGram: '6000', fetchedAt: new Date() }] as any)
  mockGetPricingConfig.mockResolvedValue({ vaGoldPct: '5', vaStonePct: '5' } as any)
  mockGetShowPricesGlobal.mockResolvedValue(true)
  mockResolvePriceVisibility.mockReturnValue(true)
  mockVariant.findUnique.mockResolvedValue({ product: { priceVisibility: 'INHERIT' } } as any)
})

// ─── GET /api/cart ─────────────────────────────────────────────────────────

describe('GET /api/cart', () => {
  it('returns cart items for authenticated user', async () => {
    mockCart.findMany.mockResolvedValue([fakeCartItem()] as any)

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

  it('includes variant, product and stones in response', async () => {
    mockCart.findMany.mockResolvedValue([])
    await GET()
    expect(mockCart.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          variant: {
            include: {
              product: {
                include: {
                  stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
                },
              },
            },
          },
        },
      })
    )
  })

  it('attaches a computed unitPrice to each item', async () => {
    mockCart.findMany.mockResolvedValue([fakeCartItem()] as any)
    const res = await GET()
    const data = await res.json()
    // goldValue 5g*6000=30000, goldVA 5%=1500, making 5*100=500,
    // taxable = 30000+1500+500 = 32000, gst = taxable*3% = 960
    // total = 32000+960 = 32960
    expect(data[0].unitPrice).toBe(32960)
  })

  it('returns empty array when cart is empty', async () => {
    mockCart.findMany.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns 401 when not authenticated', async () => {
    mockGetAppUser.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
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
        where: { userId_variantId_withExchange: { userId: 'user-1', variantId: 'v2', withExchange: false } },
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
