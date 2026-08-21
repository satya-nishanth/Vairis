import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/orders/[id]/approve-international — clears
 * intlReviewRequired's approval gate (see PATCH .../route.ts), letting the
 * order proceed to PREPARING. Mirrors the single-purpose route pattern used
 * by refund/route.ts and retry-payment/route.ts.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (!order.intlReviewRequired) {
    return NextResponse.json({ error: 'This order does not require international review' }, { status: 400 })
  }
  if (order.intlReviewApproved) return NextResponse.json({ ok: true })

  await prisma.order.update({
    where: { id },
    data: {
      intlReviewApproved: true,
      events: { create: { status: order.status, note: 'International address approved by admin' } },
    },
  })

  return NextResponse.json({ ok: true })
}
