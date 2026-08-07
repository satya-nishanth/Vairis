import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPaymentGateway } from '@/lib/payments'

export const dynamic = 'force-dynamic'

/**
 * POST /api/orders/[id]/retry-payment — relaunch the gateway checkout for a
 * customer's own PAYMENT_PENDING order. Reuses the ORIGINAL gateway order id
 * (Razorpay orders accept multiple attempts) so the price stays locked as
 * created; the 24h sweep (app/api/admin/sweep-orders) bounds the window.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params
  const gateway = getPaymentGateway()

  const order = await prisma.order.findUnique({ where: { id }, include: { payment: true } })
  if (!order || order.userId !== user.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'PAYMENT_PENDING' || !order.payment) {
    return NextResponse.json({ error: 'This order is not awaiting payment' }, { status: 409 })
  }
  if (!gateway.isConfigured() || !gateway.publicKey()) {
    return NextResponse.json({ error: 'PAYMENTS_NOT_CONFIGURED' }, { status: 503 })
  }

  // clientParams are gateway-shaped: Razorpay wants paise + order_id for its
  // SDK; the mock gateway's modal page wants rupee amount + gatewayOrderId.
  const clientParams =
    gateway.name === 'mock'
      ? {
          mock: true,
          gatewayOrderId: order.payment.razorpayOrderId,
          amount: Math.round(Number(order.payment.amount)),
          reference: order.id,
        }
      : {
          key: gateway.publicKey(),
          order_id: order.payment.razorpayOrderId,
          amount: Math.round(Number(order.payment.amount) * 100),
          currency: 'INR',
        }

  return NextResponse.json({
    orderId: order.id,
    gateway: gateway.name,
    clientParams,
    contact: { name: order.contactName, phone: order.contactPhone, email: user.email },
  })
}
