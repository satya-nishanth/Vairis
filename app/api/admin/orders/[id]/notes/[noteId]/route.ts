import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/orders/[id]/notes/[noteId] — toggle a note's visibility.
 * Checks note.orderId === the route's order id so an admin can't flip a
 * note belonging to a different order via URL manipulation.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  await requireAdmin()
  const { id, noteId } = await params
  const parsed = z.object({ internal: z.boolean() }).safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'internal boolean required' }, { status: 400 })

  const note = await prisma.orderNote.findUnique({ where: { id: noteId } })
  if (!note || note.orderId !== id) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  const updated = await prisma.orderNote.update({ where: { id: noteId }, data: { internal: parsed.data.internal } })
  return NextResponse.json(updated)
}
