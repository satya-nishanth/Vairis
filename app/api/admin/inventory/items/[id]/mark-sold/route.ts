import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { InventoryError, markInventorySold } from '@/lib/inventory'
import { inventoryActorFromSession } from '@/lib/inventory-audit'

export const dynamic = 'force-dynamic'

const schema = z
  .object({
    qty: z.number().int().positive().max(9999),
    orderId: z.string().min(1).optional(),
    unlinkedOrderLabel: z.string().trim().min(1).max(120).optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.orderId && !d.unlinkedOrderLabel) {
      ctx.addIssue({
        code: 'custom',
        message: 'Link to an order or add a text reference',
        path: ['orderId'],
      })
    }
    if (d.orderId && d.unlinkedOrderLabel) {
      ctx.addIssue({
        code: 'custom',
        message: 'Use either an order link or a text reference',
        path: ['unlinkedOrderLabel'],
      })
    }
  })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  const { id } = await params
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
      { status: 400 },
    )
  }

  try {
    await prisma.$transaction(async (tx) => {
      await markInventorySold(tx, {
        inventoryItemId: id,
        qty: parsed.data.qty,
        orderId: parsed.data.orderId,
        unlinkedOrderLabel: parsed.data.unlinkedOrderLabel,
        actor: inventoryActorFromSession(session),
      })
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof InventoryError) {
      const status =
        err.code === 'NOT_FOUND' ? 404 : err.code === 'INSUFFICIENT' ? 409 : 400
      return NextResponse.json({ error: err.message }, { status })
    }
    throw err
  }
}
