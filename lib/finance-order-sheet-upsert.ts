import { prisma } from '@/lib/prisma'
import { FINANCE_LINE_KINDS, sheetTotals, shortFinanceId } from '@/lib/finance'
import { financeActorFromSession, logFinanceAudit } from '@/lib/finance-audit'
import type { FinanceLineKind } from '@prisma/client'

export type UpsertOrderSheetLine = {
  kind: FinanceLineKind
  costPrice: number
  sellingPrice: number
}

export type UpsertOrderSheetInput = {
  orderId: string
  paidToAccountId: string
  lines: UpsertOrderSheetLine[]
}

const sheetInclude = {
  lines: true,
  paidToAccount: { select: { id: true, name: true } },
  order: { select: { contactName: true, createdAt: true, grandTotal: true } },
} as const

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

export async function upsertOrderFinanceSheet(
  input: UpsertOrderSheetInput,
  session: { user: { id: string; email?: string | null } },
) {
  if (!FINANCE_LINE_KINDS.length) {
    throw new Error('Invalid configuration')
  }
  if (!input.orderId) throw new Error('Missing order')
  if (!input.paidToAccountId) throw new Error('Paid-to account is required')

  const order = await prisma.order.findUnique({ where: { id: input.orderId }, select: { id: true } })
  if (!order) throw new Error('Order not found')

  const account = await prisma.financeAccount.findFirst({
    where: { id: input.paidToAccountId, active: true },
  })
  if (!account) throw new Error('Account not found')

  const prior = await prisma.orderFinance.findUnique({
    where: { orderId: input.orderId },
    include: sheetInclude,
  })

  const row = await prisma.$transaction(async (tx) => {
    const sheet = await tx.orderFinance.upsert({
      where: { orderId: input.orderId },
      create: { orderId: input.orderId, paidToAccountId: input.paidToAccountId },
      update: { paidToAccountId: input.paidToAccountId },
    })
    await tx.orderFinanceLine.deleteMany({ where: { sheetId: sheet.id } })
    await tx.orderFinanceLine.createMany({
      data: input.lines.map((l, i) => ({
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
    actor: financeActorFromSession(session),
    action: prior ? 'UPDATE' : 'CREATE',
    entityType: 'ORDER_SHEET',
    entityId: row.id,
    objectLabel: shortFinanceId(after.orderId || input.orderId),
    objectHref: `/admin/finance/orders?orderId=${encodeURIComponent(input.orderId)}`,
    summary: prior
      ? `Updated order sheet ${shortFinanceId(input.orderId)} (SP ₹${after.sellingPrice})`
      : `Created order sheet ${shortFinanceId(input.orderId)} (SP ₹${after.sellingPrice})`,
    before: prior ? serialize(prior) : undefined,
    after,
  })

  return after
}
