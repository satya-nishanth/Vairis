import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { QuotationStatus } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { QUOTATION_TRANSITIONS, closeThread } from '@/lib/quotations'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const quotation = await prisma.quotation.findUnique({ where: { id } })
  if (!quotation) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
  return NextResponse.json(quotation)
}

const patchSchema = z.object({
  action: z.enum(['mark_quoted', 'cancel']),
  quotedAmount: z.number().int().positive().optional(),
  quotedNotes: z.string().trim().max(500).optional(),
})

/** PATCH /api/admin/quotations/[id] — dashboard "Mark quoted" / "Cancel" actions. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const { action, quotedAmount, quotedNotes } = parsed.data

  const quotation = await prisma.quotation.findUnique({ where: { id } })
  if (!quotation) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })

  const nextStatus: QuotationStatus = action === 'mark_quoted' ? 'QUOTED' : 'CANCELLED'
  const allowed = QUOTATION_TRANSITIONS[quotation.status] ?? []
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json({ error: `Cannot move ${quotation.status} → ${nextStatus}` }, { status: 409 })
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data:
      nextStatus === 'QUOTED'
        ? { status: 'QUOTED', quotedAt: new Date(), quotedAmount, quotedNotes }
        : { status: 'CANCELLED' },
  })

  if (nextStatus === 'CANCELLED' && updated.discordThreadId) {
    try {
      await closeThread(updated.discordThreadId, '❌ Cancelled (via dashboard).')
    } catch (err) {
      console.error('[api/admin/quotations/[id]] Discord close failed', err)
    }
  }

  return NextResponse.json(updated)
}
