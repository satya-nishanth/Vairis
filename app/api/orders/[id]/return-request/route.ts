import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const schema = z.object({ reason: z.string().trim().min(5, 'Tell us briefly why') })

/**
 * POST /api/orders/[id]/return-request — customer-initiated return
 * ("Easy Returns"). Window: RETURN_WINDOW_DAYS (default 7) from the
 * DELIVERED event. Admin approves pickup / rejects from the order page.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })

  const order = await prisma.order.findUnique({
    where: { id },
    include: { events: { where: { status: 'DELIVERED' }, orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  if (!order || order.userId !== user.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'DELIVERED' && order.status !== 'DEPOSIT_REFUNDED') {
    return NextResponse.json({ error: 'This order is not eligible for a return' }, { status: 409 })
  }

  const deliveredAt = order.events[0]?.createdAt
  const windowDays = Number(process.env.RETURN_WINDOW_DAYS ?? 7)
  if (!deliveredAt || Date.now() - deliveredAt.getTime() > windowDays * 86400_000) {
    return NextResponse.json({ error: `Returns are accepted within ${windowDays} days of delivery` }, { status: 409 })
  }

  await prisma.order.update({
    where: { id },
    data: {
      status: 'RETURN_REQUESTED',
      events: { create: { status: 'RETURN_REQUESTED', note: `Customer requested return: ${parsed.data.reason}` } },
    },
  })

  return NextResponse.json({ ok: true })
}
