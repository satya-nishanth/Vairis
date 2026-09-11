import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/admin/finance/transactions/[id]/route'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    financeTransaction: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    financeAuditLog: { create: jest.fn() },
    financeTransactionOrder: { deleteMany: jest.fn(), createMany: jest.fn() },
    financeTransactionInventory: { deleteMany: jest.fn(), createMany: jest.fn() },
    financeAllocation: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn((cb) => cb(prisma)),
  },
}))
jest.mock('@/lib/finance-auth', () => ({ requireFinanceApi: jest.fn() }))

function baseExisting(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    date: new Date('2026-09-01'),
    direction: 'INFLOW',
    amount: 50000,
    gstAmount: 0,
    description: '',
    accountId: 'acc-1',
    paidThroughAccountId: 'acc-1',
    transferToAccountId: null,
    categoryId: null,
    contactId: null,
    contactName: '',
    autoCreated: false,
    reviewComplete: true,
    unlinkedOrderLabels: [],
    unlinkedInventoryLabels: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    orders: [],
    inventoryItems: [],
    allocations: [{ id: 'fa-1', amount: 50000, orderId: 'order-1', purchaseBillId: null }],
    ...overrides,
  }
}

function req(body: unknown) {
  return new NextRequest('http://localhost/api/admin/finance/transactions/tx-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/admin/finance/transactions/[id] — amount vs existing allocations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireFinanceApi as jest.Mock).mockResolvedValue({
      session: { user: { email: 'finance@thevairis.com', id: 'u1' } },
    })
  })

  it('rejects lowering amount below what is already allocated', async () => {
    ;(prisma.financeTransaction.findUnique as jest.Mock).mockResolvedValue(baseExisting())

    const res = await PATCH(req({ amount: 30000 }), { params: Promise.resolve({ id: 'tx-1' }) })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/already allocated/)
    expect(prisma.financeTransaction.update).not.toHaveBeenCalled()
  })

  it('allows raising amount above what is already allocated', async () => {
    ;(prisma.financeTransaction.findUnique as jest.Mock).mockResolvedValue(baseExisting())
    ;(prisma.financeTransaction.update as jest.Mock).mockResolvedValue(
      baseExisting({ amount: 60000 }),
    )

    const res = await PATCH(req({ amount: 60000 }), { params: Promise.resolve({ id: 'tx-1' }) })
    expect(res.status).toBe(200)
    expect(prisma.financeTransaction.update).toHaveBeenCalled()
  })

  it('allows amount changes when there are no existing allocations', async () => {
    ;(prisma.financeTransaction.findUnique as jest.Mock).mockResolvedValue(
      baseExisting({ allocations: [] }),
    )
    ;(prisma.financeTransaction.update as jest.Mock).mockResolvedValue(
      baseExisting({ amount: 100, allocations: [] }),
    )

    const res = await PATCH(req({ amount: 100 }), { params: Promise.resolve({ id: 'tx-1' }) })
    expect(res.status).toBe(200)
  })
})
