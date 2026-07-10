import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPaymentGateway } from '@/lib/payments'

export const dynamic = 'force-dynamic'

const refundSchema = z.object({
  /**
   * deposit → the 5% security deposit after delivery (the standard flow)
   * full    → everything not yet refunded (pre-shipment cancellations)
   */
  type: z.enum(['deposit', 'full']),
})

/**
 * POST /api/admin/orders/[id]/refund — initiate a refund via the gateway
 * port. This only STARTS the refund; the gateway's refund.processed
 * webhook is what flips the order to DEPOSIT_REFUNDED / REFUNDED once the
 * money actually moves. Until then the order shows "refund initiated" in
 * its timeline.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const gateway = getPaymentGateway()

  if (!gateway.isConfigured()) {
    return NextResponse.json(
      { error: `Payment gateway (${gateway.name}) not configured — cannot refund` },
      { status: 503 },
    )
  }

  const parsed = refundSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid refund type' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { payment: true } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (!order.payment?.razorpayPaymentId || order.payment.status === 'CREATED') {
    return NextResponse.json({ error: 'No captured payment to refund' }, { status: 409 })
  }

  const alreadyRefunded = Number(order.payment.refundedAmount)

  let amount: number
  if (parsed.data.type === 'deposit') {
    if (order.status !== 'DELIVERED') {
      return NextResponse.json(
        { error: 'Deposit is refunded after delivery — mark the order DELIVERED first' },
        { status: 409 },
      )
    }
    if (alreadyRefunded > 0) {
      return NextResponse.json({ error: 'Deposit already refunded' }, { status: 409 })
    }
    amount = Number(order.depositAmount)
  } else {
    if (!['PAYMENT_CONFIRMED', 'PROCESSING', 'CANCELLED'].includes(order.status)) {
      return NextResponse.json(
        { error: 'Full refunds are for cancelled / pre-shipment orders only' },
        { status: 409 },
      )
    }
    amount = Number(order.payment.amount) - alreadyRefunded
  }

  if (amount <= 0) {
    return NextResponse.json({ error: 'Nothing left to refund' }, { status: 409 })
  }

  try {
    await gateway.createRefund(order.payment.razorpayPaymentId, amount, {
      order_id: order.id,
      reason: parsed.data.type === 'deposit' ? 'security-deposit-return' : 'order-refund',
    })
  } catch (err) {
    console.error('refund initiation failed', err)
    return NextResponse.json(
      { error: 'Gateway refused the refund — check the gateway dashboard' },
      { status: 502 },
    )
  }

  // Timeline note now; the status flip happens on refund.processed webhook.
  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      status: order.status,
      note:
        parsed.data.type === 'deposit'
          ? `Security deposit refund of ₹${amount.toLocaleString('en-IN')} initiated`
          : `Full refund of ₹${amount.toLocaleString('en-IN')} initiated`,
    },
  })

  return NextResponse.json({ ok: true, amount })
}
