import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  QUOTATION_TRANSITIONS,
  isInternalApiAuthorized,
  createQuoteThread,
  postToThread,
  mentionAssignee,
} from '@/lib/quotations'

export const dynamic = 'force-dynamic'

const internalPatchSchema = z.object({
  lastReminderAt: z.string().datetime().optional(),
  reminderCount: z.number().int().min(0).optional(),
  escalatedAt: z.string().datetime().optional(),
  status: z.enum(['QUOTED', 'CANCELLED']).optional(),
  quotedAmount: z.number().int().positive().optional(),
  quotedNotes: z.string().trim().max(500).optional(),
  retryThread: z.boolean().optional(),
})

/**
 * PATCH /api/internal/quotations/[id] — bot-only. Serves three callers: reminderPoll's
 * bookkeeping write-back, the bot's /quoted and /close Discord commands, and the retryThread
 * recovery hook for a quotation whose thread creation failed at intake time.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isInternalApiAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const parsed = internalPatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const d = parsed.data

  // Only look the quotation up when a decision needs its current state — plain reminder
  // bookkeeping writes (lastReminderAt/reminderCount/escalatedAt) skip straight to the update.
  let newThreadId: string | undefined
  if (d.status || d.retryThread) {
    const quotation = await prisma.quotation.findUnique({ where: { id } })
    if (!quotation) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })

    if (d.status) {
      const allowed = QUOTATION_TRANSITIONS[quotation.status] ?? []
      if (!allowed.includes(d.status)) {
        return NextResponse.json({ error: `Cannot move ${quotation.status} → ${d.status}` }, { status: 409 })
      }
    }

    if (d.retryThread && !quotation.discordThreadId) {
      try {
        newThreadId = await createQuoteThread(`${quotation.displayId} · retry`)
        await postToThread(newThreadId, `${mentionAssignee()} (Recovered thread — original creation failed.)`)
      } catch (err) {
        console.error('[api/internal/quotations/[id]] retryThread failed', err)
      }
    }
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: {
      ...(d.lastReminderAt ? { lastReminderAt: new Date(d.lastReminderAt) } : {}),
      ...(d.reminderCount !== undefined ? { reminderCount: d.reminderCount } : {}),
      ...(d.escalatedAt ? { escalatedAt: new Date(d.escalatedAt) } : {}),
      ...(newThreadId ? { discordThreadId: newThreadId } : {}),
      ...(d.status === 'QUOTED'
        ? { status: 'QUOTED' as const, quotedAt: new Date(), quotedAmount: d.quotedAmount, quotedNotes: d.quotedNotes }
        : {}),
      ...(d.status === 'CANCELLED' ? { status: 'CANCELLED' as const } : {}),
    },
  })

  return NextResponse.json(updated)
}
