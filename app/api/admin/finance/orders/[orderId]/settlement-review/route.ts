import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit } from '@/lib/finance-audit'
import { shortFinanceId } from '@/lib/finance'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  reviewed: z.boolean(),
})

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ orderId: string }> },
) {
  const gate = await requireFinanceApi()
  if ('error' in gate) return gate.error

  const { orderId } = await ctx.params
  if (!orderId?.trim()) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
      { status: 400 },
    )
  }

  const sheet = await prisma.orderFinance.findUnique({
    where: { orderId },
    include: { order: { select: { contactName: true } } },
  })
  if (!sheet) {
    return NextResponse.json(
      { error: 'Save an order sheet before marking settlement review' },
      { status: 400 },
    )
  }

  const actor = financeActorFromSession(gate.session)
  const before = {
    settlementExceptionReviewedAt: sheet.settlementExceptionReviewedAt?.toISOString() ?? null,
    settlementExceptionReviewedBy: sheet.settlementExceptionReviewedBy,
  }

  const now = new Date()
  const updated = await prisma.orderFinance.update({
    where: { orderId },
    data: parsed.data.reviewed
      ? {
          settlementExceptionReviewedAt: now,
          settlementExceptionReviewedBy: actor.actorEmail,
        }
      : {
          settlementExceptionReviewedAt: null,
          settlementExceptionReviewedBy: null,
        },
  })

  await logFinanceAudit({
    actor,
    action: 'UPDATE',
    entityType: 'ORDER_SHEET',
    entityId: sheet.id,
    objectLabel: `${sheet.order.contactName || shortFinanceId(orderId)} · settlement review`,
    objectHref: `/admin/finance/company-audit?tab=reconciliation`,
    summary: parsed.data.reviewed
      ? `Marked settlement exception reviewed`
      : `Cleared settlement exception review`,
    before,
    after: {
      settlementExceptionReviewedAt: updated.settlementExceptionReviewedAt?.toISOString() ?? null,
      settlementExceptionReviewedBy: updated.settlementExceptionReviewedBy,
    },
  })

  return NextResponse.json({
    ok: true,
    reviewComplete: Boolean(updated.settlementExceptionReviewedAt),
    reviewedBy: updated.settlementExceptionReviewedBy,
    reviewedAt: updated.settlementExceptionReviewedAt?.toISOString() ?? null,
  })
}
