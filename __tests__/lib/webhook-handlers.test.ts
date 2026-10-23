import { confirmPayment } from '@/lib/payments/webhook-handlers'
import { prisma } from '@/lib/prisma'

const tx = {
  payment: { update: jest.fn() },
  order: { update: jest.fn() },
  orderItem: { findMany: jest.fn() },
  cartItem: { deleteMany: jest.fn() },
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: { findUnique: jest.fn() },
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
  },
}))
jest.mock('@/lib/email', () => ({ sendOrderConfirmationEmail: jest.fn() }))
jest.mock('@/lib/refunds', () => ({ initiateRefund: jest.fn(), statusAfterRefund: jest.fn() }))
jest.mock('@/lib/split', () => ({ autoSplitOrder: jest.fn() }))
jest.mock('@/lib/finance-auto-inflow', () => ({ createAutoOrderPaymentInflow: jest.fn() }))

describe('confirmPayment — cart clearing (STG-44)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay1',
      orderId: 'order1',
      status: 'CREATED',
      order: { userId: 'u1', status: 'PAYMENT_PENDING', grandTotal: 1000, contactName: 'A' },
    })
    tx.orderItem.findMany.mockResolvedValue([{ variantId: 'v1' }, { variantId: 'v2' }])
  })

  it("removes only the paid order's variants from the cart", async () => {
    await confirmPayment('gw1', 'gp1', 'Payment captured')

    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', variantId: { in: ['v1', 'v2'] } },
    })
  })

  it('does not touch the cart when the payment was already captured', async () => {
    ;(prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay1',
      orderId: 'order1',
      status: 'CAPTURED',
      order: { userId: 'u1', status: 'PAYMENT_CONFIRMED', grandTotal: 1000, contactName: 'A' },
    })

    await confirmPayment('gw1', 'gp1', 'Payment captured')

    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled()
  })
})
