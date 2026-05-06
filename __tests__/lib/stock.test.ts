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

describe('decrementStock', () => {
  it('throws when stock insufficient', async () => {
    mockVariant.findMany.mockResolvedValue([{ id: 'v1', stock: 1 } as any])
    await expect(decrementStock([{ variantId: 'v1', quantity: 2 }])).rejects.toThrow(
      'Insufficient stock'
    )
  })

  it('decrements when stock sufficient', async () => {
    mockVariant.findMany.mockResolvedValue([{ id: 'v1', stock: 5 } as any])
    mockVariant.update.mockResolvedValue({} as any)
    await expect(decrementStock([{ variantId: 'v1', quantity: 2 }])).resolves.toBeUndefined()
    expect(mockVariant.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { stock: { decrement: 2 } },
    })
  })
})

describe('restoreStock', () => {
  it('increments stock for each item', async () => {
    mockVariant.update.mockResolvedValue({} as any)
    await restoreStock([{ variantId: 'v1', quantity: 3 }])
    expect(mockVariant.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { stock: { increment: 3 } },
    })
  })
})
