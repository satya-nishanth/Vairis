import { NextRequest, NextResponse } from 'next/server'
import { getAppUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPaymentGateway } from '@/lib/payments'
import { confirmPayment } from '@/lib/payments/webhook-handlers'

export const dynamic = 'force-dynamic'

/**
 * POST /api/payment/verify — called by the browser from the gateway SDK's
 * success handler. Verifies proof-of-payment via the gateway port, then
 * runs the same idempotent confirmation transition the webhook uses
 * (belt and suspenders — the webhook wins if the customer closes the tab
 * before this fires).
 */
export async function POST(req: NextRequest) {
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gateway = getPaymentGateway()

  const body = (await req.json().catch(() => ({}))) as {
    gatewayOrderId?: string
    gatewayPaymentId?: string
    signature?: string
  }
  if (!body.gatewayOrderId || !body.gatewayPaymentId || !body.signature) {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
  }

  if (
    !gateway.verifyClientPayment({
      gatewayOrderId: body.gatewayOrderId,
      gatewayPaymentId: body.gatewayPaymentId,
      signature: body.signature,
    })
  ) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
  }

  // Ownership check before confirming — never confirm another user's order.
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: body.gatewayOrderId },
    include: { order: { select: { userId: true } } },
  })
  if (!payment || payment.order.userId !== user.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const result = await confirmPayment(body.gatewayOrderId, body.gatewayPaymentId, 'Payment captured')
  return NextResponse.json({ ok: true, orderId: result?.orderId ?? payment.orderId })
}
