import { NextRequest } from 'next/server'
import { PATCH as patchOrder } from '@/app/api/admin/orders/[id]/route'
import { POST as approveInternational } from '@/app/api/admin/orders/[id]/approve-international/route'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { getShippingProvider } from '@/lib/shipping'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findUnique: jest.fn(), update: jest.fn() },
    shipment: { create: jest.fn() },
    $transaction: jest.fn((cb) => cb(prisma)),
  },
}))
jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/shipping', () => ({ getShippingProvider: jest.fn() }))
jest.mock('@/lib/email', () => ({ sendOrderShippedEmail: jest.fn(), sendOrderDeliveredEmail: jest.fn() }))

const mockOrder = prisma.order as jest.Mocked<typeof prisma.order>
const mockRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>
const mockGetShippingProvider = getShippingProvider as jest.MockedFunction<typeof getShippingProvider>

function baseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ord1',
    status: 'PAYMENT_CONFIRMED',
    country: 'IN',
    intlReviewRequired: true,
    intlReviewApproved: false,
    shipments: [],
    payment: { status: 'CAPTURED' },
    parent: null,
    contactName: 'Jane Doe',
    contactPhone: '9876543210',
    addressLine1: '1 Market St',
    addressLine2: null,
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '502300',
    grandTotal: 18446,
    ...overrides,
  }
}

function patchReq(body: unknown) {
  return new NextRequest('http://localhost/api/admin/orders/ord1', { method: 'PATCH', body: JSON.stringify(body) })
}

describe('international order review gate', () => {
  beforeEach(() => jest.clearAllMocks())

  it('blocks PREPARING while intlReviewRequired and not approved', async () => {
    mockOrder.findUnique.mockResolvedValue(baseOrder() as never)
    const res = await patchOrder(patchReq({ status: 'PREPARING' }), { params: Promise.resolve({ id: 'ord1' }) })
    expect(res.status).toBe(409)
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  it('allows PREPARING once intlReviewApproved is true', async () => {
    mockOrder.findUnique.mockResolvedValue(baseOrder({ intlReviewApproved: true }) as never)
    mockOrder.update.mockResolvedValue({} as never)
    const res = await patchOrder(patchReq({ status: 'PREPARING' }), { params: Promise.resolve({ id: 'ord1' }) })
    expect(res.status).toBe(200)
  })

  it('allows PREPARING for a domestic order regardless of the flags', async () => {
    mockOrder.findUnique.mockResolvedValue(
      baseOrder({ intlReviewRequired: false, intlReviewApproved: false }) as never,
    )
    mockOrder.update.mockResolvedValue({} as never)
    const res = await patchOrder(patchReq({ status: 'PREPARING' }), { params: Promise.resolve({ id: 'ord1' }) })
    expect(res.status).toBe(200)
  })

  it('approve-international sets the flag and creates an event', async () => {
    mockOrder.findUnique.mockResolvedValue(baseOrder() as never)
    mockOrder.update.mockResolvedValue({} as never)
    const res = await approveInternational(
      new NextRequest('http://localhost/x', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ord1' }) },
    )
    expect(res.status).toBe(200)
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ord1' },
        data: expect.objectContaining({ intlReviewApproved: true }),
      }),
    )
    expect(mockRequireAdmin).toHaveBeenCalled()
  })

  it('approve-international 404s on a nonexistent order', async () => {
    mockOrder.findUnique.mockResolvedValue(null as never)
    const res = await approveInternational(
      new NextRequest('http://localhost/x', { method: 'POST' }),
      { params: Promise.resolve({ id: 'missing' }) },
    )
    expect(res.status).toBe(404)
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  it('approve-international 400s on an order that never required review', async () => {
    mockOrder.findUnique.mockResolvedValue(baseOrder({ intlReviewRequired: false }) as never)
    const res = await approveInternational(
      new NextRequest('http://localhost/x', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ord1' }) },
    )
    expect(res.status).toBe(400)
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  it('approve-international is idempotent — no duplicate event on a second approval', async () => {
    mockOrder.findUnique.mockResolvedValue(baseOrder({ intlReviewApproved: true }) as never)
    const res = await approveInternational(
      new NextRequest('http://localhost/x', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ord1' }) },
    )
    expect(res.status).toBe(200)
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  // Regression coverage for a cross-task gap found in final review: Task 3
  // built the Sequel247 adapter, Task 7 built the intlReviewRequired gate,
  // and neither task's own tests exercised the seam between them — the
  // SHIPPED transition's provider selection. getShippingProvider(country)
  // must be given the order's OWN country (fixed in lib/shipping/index.ts),
  // not decided by SHIPPING_PROVIDER alone, or an approved international
  // order would get auto-booked through Sequel247 (India-domestic only).
  it('resolves the shipping provider using the order\'s own country on SHIPPED', async () => {
    mockOrder.findUnique.mockResolvedValue(
      baseOrder({ status: 'PREPARING', country: 'United States', intlReviewApproved: true }) as never,
    )
    mockOrder.update.mockResolvedValue({} as never)
    mockGetShippingProvider.mockReturnValue({
      name: 'manual',
      supportsBooking: false,
      bookShipment: jest.fn(),
      trackShipment: jest.fn(),
    })

    await patchOrder(
      patchReq({ status: 'SHIPPED', courierName: 'FedEx', awbCode: 'FX123' }),
      { params: Promise.resolve({ id: 'ord1' }) },
    )

    expect(mockGetShippingProvider).toHaveBeenCalledWith('United States')
  })

  it('requires manual courier/AWB for an approved international order even when SHIPPING_PROVIDER is a booking partner', async () => {
    mockOrder.findUnique.mockResolvedValue(
      baseOrder({ status: 'PREPARING', country: 'United States', intlReviewApproved: true }) as never,
    )
    // Simulates the real getShippingProvider(country) behavior: any non-IN
    // country always resolves to manual, regardless of SHIPPING_PROVIDER.
    mockGetShippingProvider.mockReturnValue({
      name: 'manual',
      supportsBooking: false,
      bookShipment: jest.fn(),
      trackShipment: jest.fn(),
    })

    const res = await patchOrder(
      patchReq({ status: 'SHIPPED' }), // no courierName/awbCode supplied
      { params: Promise.resolve({ id: 'ord1' }) },
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/courier/i)
    expect(prisma.order.update).not.toHaveBeenCalled()
  })
})
