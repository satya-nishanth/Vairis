import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const schema = z.object({ body: z.string().trim().min(1).max(2000), internal: z.boolean().optional() })

/**
 * POST /api/admin/orders/[id]/notes — add a note to an order (author = admin
 * session email). `internal` defaults true; only `internal: false` notes are
 * ever shown on customer surfaces (order page, track-order).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  const { id } = await params
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Note body required' }, { status: 400 })

  const order = await prisma.order.findUnique({ where: { id }, select: { id: true } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const note = await prisma.orderNote.create({
    data: { orderId: id, author: session.user.email!, body: parsed.data.body, internal: parsed.data.internal ?? true },
  })
  return NextResponse.json(note, { status: 201 })
}
