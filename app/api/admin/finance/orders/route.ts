import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit } from '@/lib/finance-audit'
import { FINANCE_LINE_KINDS, sheetTotals, shortFinanceId } from '@/lib/finance'
import type { FinanceLineKind } from '@prisma/client'

export const dynamic = 'force-dynamic'

const lineSchema = z.object({
  kind: z.enum(FINANCE_LINE_KINDS),
  costPrice: z.number().min(0),
  sellingPrice: z.number().min(0),
})

const upsertSchema = z.object({
  orderId: z.string().min(1),
  paidToAccountId: z.string().min(1, 'Paid-to account is required'),
  lines: z.array(lineSchema).min(1, 'Add at least one line'),
})

function serialize(row: {
  id: string
  orderId: string
  paidToAccountId: string
  createdAt: Date
  updatedAt: Date
  lines: {
    id: string
    kind: FinanceLineKind
    costPrice: { toString(): string } | number
    sellingPrice: { toString(): string } | number
    sortOrder: number
  }[]
  paidToAccount?: { id: string; name: string }
  order?: { contactName: string; createdAt: Date; grandTotal: { toString(): string } | number }
}) {
  const lines = [...row.lines]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => ({
      id: l.id,
      kind: l.kind,
      costPrice: Number(l.costPrice),
      sellingPrice: Number(l.sellingPrice),
    }))
  const totals = sheetTotals(lines)
  return {
    id: row.id,
    orderId: row.orderId,
    paidToAccountId: row.paidToAccountId,
    paidToAccountName: row.paidToAccount?.name ?? null,
    // legacy alias for older clients during transition
    customerPaidTo: row.paidToAccountId,
    lines,
    cost: totals.cost,
    sellingPrice: totals.selling,
    profit: totals.profit,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    order: row.order
      ? {
          contactName: row.order.contactName,
          createdAt: row.order.createdAt.toISOString(),
          grandTotal: Number(row.order.grandTotal),
        }
      : undefined,
  }
}

const sheetInclude = {
  lines: true,
  paidToAccount: { select: { id: true, name: true } },
  order: { select: { contactName: true, createdAt: true, grandTotal: true } },
} as const

export async function GET(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error

  const orderId = req.nextUrl.searchParams.get('orderId')?.trim()
  if (orderId) {
    const row = await prisma.orderFinance.findUnique({
      where: { orderId },
      include: sheetInclude,
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(serialize(row))
  }

  const rows = await prisma.orderFinance.findMany({
    orderBy: { updatedAt: 'desc' },
    include: sheetInclude,
  })
  return NextResponse.json(rows.map(serialize))
}

export async function POST(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const parsed = upsertSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data
  const order = await prisma.order.findUnique({ where: { id: d.orderId }, select: { id: true } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  const account = await prisma.financeAccount.findFirst({
    where: { id: d.paidToAccountId, active: true },
  })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 400 })

  const prior = await prisma.orderFinance.findUnique({
    where: { orderId: d.orderId },
    include: sheetInclude,
  })

  const row = await prisma.$transaction(async (tx) => {
    const sheet = await tx.orderFinance.upsert({
      where: { orderId: d.orderId },
      create: { orderId: d.orderId, paidToAccountId: d.paidToAccountId },
      update: { paidToAccountId: d.paidToAccountId },
    })
    await tx.orderFinanceLine.deleteMany({ where: { sheetId: sheet.id } })
    await tx.orderFinanceLine.createMany({
      data: d.lines.map((l, i) => ({
        sheetId: sheet.id,
        kind: l.kind,
        costPrice: l.costPrice,
        sellingPrice: l.sellingPrice,
        sortOrder: i,
      })),
    })
    return tx.orderFinance.findUniqueOrThrow({
      where: { id: sheet.id },
      include: sheetInclude,
    })
  })
  const after = serialize(row)
  await logFinanceAudit({
    actor: financeActorFromSession(gate.session),
    action: prior ? 'UPDATE' : 'CREATE',
    entityType: 'ORDER_SHEET',
    entityId: row.id,
    objectLabel: shortFinanceId(after.orderId || d.orderId),
    objectHref: `/admin/finance/orders?orderId=${encodeURIComponent(d.orderId)}`,
    summary: prior
      ? `Updated order sheet ${shortFinanceId(d.orderId)} (SP ₹${after.sellingPrice.toLocaleString('en-IN')})`
      : `Created order sheet ${shortFinanceId(d.orderId)} (SP ₹${after.sellingPrice.toLocaleString('en-IN')})`,
    before: prior ? serialize(prior) : undefined,
    after,
  })
  return NextResponse.json(after)
}
