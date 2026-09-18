import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit } from '@/lib/finance-audit'
import {
  collectedByOrderIds,
  orderPaymentSummary,
  settledInCompanyBankByOrderIds,
} from '@/lib/finance-collections'
import { FINANCE_LINE_KINDS, sheetTotals, shortFinanceId } from '@/lib/finance'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  settle: z.boolean(),
  note: z.string().max(2000).optional(),
})

async function resolvePaidToAccountId(preferredId: string | null | undefined): Promise<string | null> {
  if (preferredId) {
    const ok = await prisma.financeAccount.findFirst({
      where: { id: preferredId, active: true },
      select: { id: true },
    })
    if (ok) return ok.id
  }
  const company = await prisma.financeAccount.findFirst({
    where: { active: true, type: 'COMPANY_BANK' },
    orderBy: { name: 'asc' },
    select: { id: true },
  })
  if (company) return company.id
  const any = await prisma.financeAccount.findFirst({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true },
  })
  return any?.id ?? null
}

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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }

  let sheet = await prisma.orderFinance.findUnique({
    where: { orderId },
    include: {
      lines: true,
      order: { select: { id: true, contactName: true, grandTotal: true } },
    },
  })

  // Allow settle on unsettled orders that don't have a sheet yet — create a stub.
  if (!sheet && parsed.data.settle) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, contactName: true, grandTotal: true },
    })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    const paidToAccountId = await resolvePaidToAccountId(null)
    if (!paidToAccountId) {
      return NextResponse.json({ error: 'No finance account configured' }, { status: 400 })
    }
    sheet = await prisma.$transaction(async (tx) => {
      const created = await tx.orderFinance.create({
        data: {
          orderId,
          paidToAccountId,
          roundOffEnabled: true,
          lines: {
            create: FINANCE_LINE_KINDS.map((kind, i) => ({
              kind,
              costPrice: 0,
              sellingPrice: 0,
              sortOrder: i,
            })),
          },
        },
      })
      return tx.orderFinance.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          lines: true,
          order: { select: { id: true, contactName: true, grandTotal: true } },
        },
      })
    })
  }

  if (!sheet) {
    return NextResponse.json(
      { error: 'Save an order sheet before clearing manual settle' },
      { status: 400 },
    )
  }

  const actor = financeActorFromSession(gate.session)
  const before = {
    manuallySettledAt: sheet.manuallySettledAt?.toISOString() ?? null,
    manuallySettledNote: sheet.manuallySettledNote,
    manuallySettledBy: sheet.manuallySettledBy,
  }

  if (!parsed.data.settle) {
    const updated = await prisma.orderFinance.update({
      where: { orderId },
      data: {
        manuallySettledAt: null,
        manuallySettledNote: '',
        manuallySettledBy: null,
      },
    })
    await logFinanceAudit({
      actor,
      action: 'UPDATE',
      entityType: 'ORDER_SHEET',
      entityId: sheet.id,
      objectLabel: `${sheet.order.contactName || shortFinanceId(orderId)} · clear manual settle`,
      objectHref: `/admin/finance/orders?orderId=${encodeURIComponent(orderId)}`,
      summary: 'Cleared manual settle on order sheet',
      before,
      after: {
        manuallySettledAt: null,
        manuallySettledNote: '',
        manuallySettledBy: null,
      },
    })
    return NextResponse.json({
      ok: true,
      manuallySettled: false,
      manuallySettledAt: null,
      manuallySettledNote: '',
      updatedAt: updated.updatedAt.toISOString(),
    })
  }

  const note = (parsed.data.note ?? '').trim()
  if (!note) {
    return NextResponse.json({ error: 'Notes are required to manually settle' }, { status: 400 })
  }

  const totals = sheetTotals(
    sheet.lines.map((l) => ({
      kind: l.kind,
      costPrice: Number(l.costPrice),
      sellingPrice: Number(l.sellingPrice),
    })),
    { roundOffEnabled: sheet.roundOffEnabled },
  )
  const summary = orderPaymentSummary({
    grandTotal: Number(sheet.order.grandTotal),
    sheetSelling: totals.selling > 0 ? totals.selling : null,
    collected: (await collectedByOrderIds([orderId])).get(orderId) ?? 0,
  })

  const inBankMap = await settledInCompanyBankByOrderIds([orderId])
  const inBank = inBankMap.get(orderId) ?? 0
  if (summary.expected > 0 && inBank >= summary.expected - 0.009) {
    return NextResponse.json(
      {
        error:
          'Already settled via Company bank. Manual settle is only needed when funds have not reached Company bank.',
      },
      { status: 400 },
    )
  }

  const now = new Date()
  const updated = await prisma.orderFinance.update({
    where: { orderId },
    data: {
      manuallySettledAt: now,
      manuallySettledNote: note,
      manuallySettledBy: actor.actorEmail,
    },
  })

  await logFinanceAudit({
    actor,
    action: 'UPDATE',
    entityType: 'ORDER_SHEET',
    entityId: sheet.id,
    objectLabel: `${sheet.order.contactName || shortFinanceId(orderId)} · manual settle`,
    objectHref: `/admin/finance/orders?orderId=${encodeURIComponent(orderId)}`,
    summary: `Manually settled order sheet: ${note.slice(0, 120)}`,
    before,
    after: {
      manuallySettledAt: now.toISOString(),
      manuallySettledNote: note,
      manuallySettledBy: actor.actorEmail,
    },
  })

  return NextResponse.json({
    ok: true,
    manuallySettled: true,
    manuallySettledAt: updated.manuallySettledAt?.toISOString() ?? null,
    manuallySettledNote: updated.manuallySettledNote,
    manuallySettledBy: updated.manuallySettledBy,
  })
}
