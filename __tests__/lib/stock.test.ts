import { decrementStock, restoreStock } from '@/lib/stock'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    productVariant: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((ops: any) => {
      if (typeof ops === 'function') return ops(prisma)
      return Promise.all(ops)
    }),
  },
}))

const mockVariant = prisma.productVariant as jest.Mocked<typeof prisma.productVariant>

beforeEach(() => jest.clearAllMocks())

// ─── decrementStock ───────────────────────────────────────────────────────

describe('decrementStock', () => {
  it('throws when stock is insufficient', async () => {
    mockVariant.findMany.mockResolvedValue([{ id: 'v1', stock: 1 } as any])
    await expect(decrementStock([{ variantId: 'v1', quantity: 2 }])).rejects.toThrow(
      'Insufficient stock'
    )
  })

  it('throws when variant not found', async () => {
    mockVariant.findMany.mockResolvedValue([])
    await expect(decrementStock([{ variantId: 'missing', quantity: 1 }])).rejects.toThrow(
      'Insufficient stock'
    )
  })

  it('throws when exact stock equals 0', async () => {
    mockVariant.findMany.mockResolvedValue([{ id: 'v1', stock: 0 } as any])
    await expect(decrementStock([{ variantId: 'v1', quantity: 1 }])).rejects.toThrow(
      'Insufficient stock'
    )
  })

  it('succeeds and calls update when stock sufficient', async () => {
    mockVariant.findMany.mockResolvedValue([{ id: 'v1', stock: 5 } as any])
    mockVariant.update.mockResolvedValue({} as any)
    await expect(decrementStock([{ variantId: 'v1', quantity: 3 }])).resolves.toBeUndefined()
    expect(mockVariant.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { stock: { decrement: 3 } },
    })
  })

  it('succeeds when quantity exactly equals stock (boundary)', async () => {
    mockVariant.findMany.mockResolvedValue([{ id: 'v1', stock: 3 } as any])
    mockVariant.update.mockResolvedValue({} as any)
    await expect(decrementStock([{ variantId: 'v1', quantity: 3 }])).resolves.toBeUndefined()
  })

  it('handles multiple variants — all checked before any update', async () => {
    mockVariant.findMany.mockResolvedValue([
      { id: 'v1', stock: 5 } as any,
      { id: 'v2', stock: 1 } as any,
    ])
    // v2 has only 1 but we request 2 → should throw before updating v1
    await expect(
      decrementStock([
        { variantId: 'v1', quantity: 2 },
        { variantId: 'v2', quantity: 2 },
      ])
    ).rejects.toThrow('Insufficient stock')
    expect(mockVariant.update).not.toHaveBeenCalled()
  })

  it('decrements multiple variants in a transaction', async () => {
    mockVariant.findMany.mockResolvedValue([
      { id: 'v1', stock: 10 } as any,
      { id: 'v2', stock: 5 } as any,
    ])
    mockVariant.update.mockResolvedValue({} as any)
    await decrementStock([
      { variantId: 'v1', quantity: 3 },
      { variantId: 'v2', quantity: 2 },
    ])
    expect(mockVariant.update).toHaveBeenCalledTimes(2)
    expect(mockVariant.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { stock: { decrement: 3 } },
    })
    expect(mockVariant.update).toHaveBeenCalledWith({
      where: { id: 'v2' },
      data: { stock: { decrement: 2 } },
    })
  })
})

// ─── restoreStock ─────────────────────────────────────────────────────────

describe('restoreStock', () => {
  it('increments stock for a single item', async () => {
    mockVariant.update.mockResolvedValue({} as any)
    await restoreStock([{ variantId: 'v1', quantity: 3 }])
    expect(mockVariant.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { stock: { increment: 3 } },
    })
  })

  it('restores multiple variants', async () => {
    mockVariant.update.mockResolvedValue({} as any)
    await restoreStock([
      { variantId: 'v1', quantity: 2 },
      { variantId: 'v2', quantity: 5 },
    ])
    expect(mockVariant.update).toHaveBeenCalledTimes(2)
  })

  it('handles empty items array without error', async () => {
    await expect(restoreStock([])).resolves.toBeUndefined()
    expect(mockVariant.update).not.toHaveBeenCalled()
  })
})
