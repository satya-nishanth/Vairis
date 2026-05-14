import { NextRequest } from 'next/server'
import { GET as listProducts, POST as createProduct } from '@/app/api/admin/products/route'
import {
  GET as getProduct,
  PATCH as updateProduct,
  DELETE as deleteProduct,
} from '@/app/api/admin/products/[id]/route'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))
jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn(),
}))
jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))

const mockProduct = prisma.product as jest.Mocked<typeof prisma.product>
const mockRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>

const fakeSession = { user: { email: 'admin@vairis.com', id: 'uid-1' } }
const fakeProduct = (overrides = {}) => ({
  id: 'p1',
  name: 'Test Ring',
  description: 'A ring',
  category: 'RINGS',
  images: [],
  basePrice: '0',
  isActive: true,
  createdAt: new Date(),
  itemCode: 'AJBR-74',
  designStyle: null,
  totalLengthMm: null,
  motifSizeMm: null,
  thicknessMm: null,
  stoneType: 'Diamond',
  stoneShape: 'Round',
  stoneDimMm: '4.80 x 4.80',
  gemCount: 5,
  caratWeight: '2.00',
  variants: [],
  ...overrides,
})

function makeReq(url: string, method = 'GET', body?: object) {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  })
}

const idParams = (id = 'p1') => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAdmin.mockResolvedValue(fakeSession as any)
})

// ─── GET /api/admin/products ───────────────────────────────────────────────

describe('GET /api/admin/products', () => {
  it('returns all products including inactive', async () => {
    const products = [fakeProduct(), fakeProduct({ id: 'p2', isActive: false })]
    mockProduct.findMany.mockResolvedValue(products as any)

    const res = await listProducts()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(2)
  })

  it('requires admin auth', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('REDIRECT:/auth/login'))
    await expect(listProducts()).rejects.toThrow('REDIRECT:/auth/login')
    expect(mockProduct.findMany).not.toHaveBeenCalled()
  })

  it('includes variants in response', async () => {
    mockProduct.findMany.mockResolvedValue([])
    await listProducts()
    expect(mockProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { variants: true } })
    )
  })
})

// ─── POST /api/admin/products ──────────────────────────────────────────────

describe('POST /api/admin/products', () => {
  const validBody = {
    name: 'Heart Bracelet',
    description: 'Diamond bracelet',
    category: 'BRACELETS',
    itemCode: 'AJBR-74',
    stoneType: 'Diamond',
    gemCount: 5,
    caratWeight: 2.0,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: '8.5', makingChargePerGram: '400', flatMakingCharge: '0', stoneCharges: '18000', miscCharges: '45', stock: '3', sku: 'AJBR-74-G18K' },
      { metalType: 'GOLD_14K', weightGrams: '5.95', makingChargePerGram: '400', flatMakingCharge: '0', stoneCharges: '18000', miscCharges: '45', stock: '5', sku: 'AJBR-74-G14K' },
    ],
  }

  it('creates product and returns 201', async () => {
    mockProduct.create.mockResolvedValue(fakeProduct() as any)
    const req = makeReq('http://localhost/api/admin/products', 'POST', validBody)
    const res = await createProduct(req)
    expect(res.status).toBe(201)
  })

  it('passes all spec fields to prisma.create', async () => {
    mockProduct.create.mockResolvedValue(fakeProduct() as any)
    const req = makeReq('http://localhost/api/admin/products', 'POST', validBody)
    await createProduct(req)
    const call = mockProduct.create.mock.calls[0][0]
    expect(call.data.name).toBe('Heart Bracelet')
    expect(call.data.itemCode).toBe('AJBR-74')
    expect(call.data.stoneType).toBe('Diamond')
    expect(call.data.gemCount).toBe(5)
    expect(Number(call.data.caratWeight)).toBe(2.0)
  })

  it('creates nested variants', async () => {
    mockProduct.create.mockResolvedValue(fakeProduct() as any)
    const req = makeReq('http://localhost/api/admin/products', 'POST', validBody)
    await createProduct(req)
    const call = mockProduct.create.mock.calls[0][0]
    expect(call.data.variants.create).toHaveLength(2)
    expect(call.data.variants.create[0].metalType).toBe('GOLD_18K')
    expect(Number(call.data.variants.create[0].weightGrams)).toBe(8.5)
    expect(Number(call.data.variants.create[0].makingChargePerGram)).toBe(400)
    expect(Number(call.data.variants.create[0].stoneCharges)).toBe(18000)
    expect(Number(call.data.variants.create[0].miscCharges)).toBe(45)
    expect(call.data.variants.create[0].sku).toBe('AJBR-74-G18K')
  })

  it('converts empty itemCode to null', async () => {
    mockProduct.create.mockResolvedValue(fakeProduct() as any)
    const req = makeReq('http://localhost/api/admin/products', 'POST', { ...validBody, itemCode: '' })
    await createProduct(req)
    expect(mockProduct.create.mock.calls[0][0].data.itemCode).toBeNull()
  })

  it('returns 400 when makingChargePerGram is missing from a variant', async () => {
    const badBody = {
      ...validBody,
      variants: [{ metalType: 'GOLD_18K', weightGrams: '8.5', stock: '3', sku: 'AJBR-74-G18K' }],
    }
    const req = makeReq('http://localhost/api/admin/products', 'POST', badBody)
    const res = await createProduct(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Validation failed')
  })

  it('returns 400 when weight is zero', async () => {
    const badBody = {
      ...validBody,
      variants: [{ ...validBody.variants[0], weightGrams: '0' }],
    }
    const req = makeReq('http://localhost/api/admin/products', 'POST', badBody)
    const res = await createProduct(req)
    expect(res.status).toBe(400)
  })

  it('requires admin auth', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('REDIRECT:/'))
    const req = makeReq('http://localhost/api/admin/products', 'POST', validBody)
    await expect(createProduct(req)).rejects.toThrow('REDIRECT:/')
    expect(mockProduct.create).not.toHaveBeenCalled()
  })
})

// ─── GET /api/admin/products/[id] ─────────────────────────────────────────

describe('GET /api/admin/products/[id]', () => {
  it('returns product by id', async () => {
    mockProduct.findUnique.mockResolvedValue(fakeProduct() as any)
    const res = await getProduct(makeReq('http://localhost/api/admin/products/p1'), idParams())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('p1')
  })

  it('returns 404 when product not found', async () => {
    mockProduct.findUnique.mockResolvedValue(null)
    const res = await getProduct(makeReq('http://localhost/api/admin/products/xx'), idParams('xx'))
    expect(res.status).toBe(404)
  })
})

// ─── PATCH /api/admin/products/[id] ───────────────────────────────────────

describe('PATCH /api/admin/products/[id]', () => {
  it('updates name and returns updated product', async () => {
    const updated = fakeProduct({ name: 'Updated Ring' })
    mockProduct.update.mockResolvedValue(updated as any)

    const req = makeReq('http://localhost/api/admin/products/p1', 'PATCH', { name: 'Updated Ring' })
    const res = await updateProduct(req, idParams())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('Updated Ring')
  })

  it('replaces variants when variants array provided', async () => {
    mockProduct.update.mockResolvedValue(fakeProduct() as any)
    const req = makeReq('http://localhost/api/admin/products/p1', 'PATCH', {
      variants: [{ metalType: 'GOLD_14K', weightGrams: '9.0', makingChargePerGram: '350', stoneCharges: '0', miscCharges: '45', stock: '2', sku: 'AJBR-74-G14K' }],
    })
    await updateProduct(req, idParams())
    const call = mockProduct.update.mock.calls[0][0]
    expect(call.data.variants).toMatchObject({
      deleteMany: {},
      create: [expect.objectContaining({ metalType: 'GOLD_14K' })],
    })
  })

  it('skips variants key when not provided', async () => {
    mockProduct.update.mockResolvedValue(fakeProduct() as any)
    const req = makeReq('http://localhost/api/admin/products/p1', 'PATCH', { name: 'New Name' })
    await updateProduct(req, idParams())
    const call = mockProduct.update.mock.calls[0][0]
    expect(call.data.variants).toBeUndefined()
  })

  it('requires admin auth', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('REDIRECT:/'))
    const req = makeReq('http://localhost/api/admin/products/p1', 'PATCH', { name: 'x' })
    await expect(updateProduct(req, idParams())).rejects.toThrow('REDIRECT:/')
  })
})

// ─── DELETE /api/admin/products/[id] ──────────────────────────────────────

describe('DELETE /api/admin/products/[id]', () => {
  it('returns 204 on successful delete', async () => {
    mockProduct.delete.mockResolvedValue(fakeProduct() as any)
    const req = makeReq('http://localhost/api/admin/products/p1', 'DELETE')
    const res = await deleteProduct(req, idParams())
    expect(res.status).toBe(204)
  })

  it('calls prisma.product.delete with correct id', async () => {
    mockProduct.delete.mockResolvedValue(fakeProduct() as any)
    const req = makeReq('http://localhost/api/admin/products/p1', 'DELETE')
    await deleteProduct(req, idParams('p1'))
    expect(mockProduct.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
  })

  it('requires admin auth', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('REDIRECT:/'))
    const req = makeReq('http://localhost/api/admin/products/p1', 'DELETE')
    await expect(deleteProduct(req, idParams())).rejects.toThrow('REDIRECT:/')
    expect(mockProduct.delete).not.toHaveBeenCalled()
  })
})
