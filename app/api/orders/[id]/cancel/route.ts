import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { initiateRefund } from '@/lib/refunds'

export const dynamic = 'force-dynamic'

const schema = z.object({
  reason: z.string().trim().min(3, 'Tell us why you are cancelling').max(300),
})

/**
 * POST /api/orders/[id]/cancel — customer self-serve cancellation.
 * Allowed pre-dispatch only (PAYMENT_PENDING / PAYMENT_CONFIRMED / PREPARING).
 * Paid orders get an automatic full gateway refund via the refund ledger;
 * unpaid orders just cancel.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { payment: true } })
  if (!order || order.userId !== user.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const cancellable = ['PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'PREPARING']
  if (!cancellable.includes(order.status)) {
    return NextResponse.json(
      { error: 'This order has already been dispatched — request a return after delivery instead.' },
      { status: 409 },
    )
  }

  const paid = order.payment?.status === 'CAPTURED'

  // Race-safe flip: only cancel if still in a cancellable status.
  const updated = await prisma.order.updateMany({
    where: { id, status: { in: ['PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'PREPARING'] } },
    data: { status: 'CANCELLED' },
  })
  if (updated.count === 0) {
    return NextResponse.json({ error: 'Order state changed — refresh and try again' }, { status: 409 })
  }
  await prisma.orderEvent.create({
    data: { orderId: id, status: 'CANCELLED', note: `Cancelled by customer — ${parsed.data.reason}` },
  })
  await prisma.promoRedemption.deleteMany({ where: { orderId: id } })

  if (paid) {
    const refund = await initiateRefund({
      orderId: id,
      kind: 'FULL',
      reason: `Customer cancellation — ${parsed.data.reason}`,
    })
    if (!refund.ok) {
      // Cancellation stands; refund needs admin attention.
      await prisma.orderNote.create({
        data: {
          orderId: id,
          author: 'system',
          body: `AUTO-REFUND FAILED after customer cancellation: ${refund.error}. Refund manually.`,
          internal: true,
        },
      })
      return NextResponse.json({ ok: true, refundPending: true })
    }
    return NextResponse.json({ ok: true, refundInitiated: true, amount: refund.amount })
  }

  return NextResponse.json({ ok: true })
}
