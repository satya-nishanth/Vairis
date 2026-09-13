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
  /** Vendor wallet the purchase (CP) is attributed to; required when CP > 0. */
  purchaseFromAccountId?: string | null
  lines: UpsertOrderSheetLine[]
  roundOffEnabled?: boolean
}

const sheetInclude = {
  lines: true,
  paidToAccount: { select: { id: true, name: true } },
  purchaseFromAccount: { select: { id: true, name: true } },
  order: { select: { contactName: true, createdAt: true, grandTotal: true } },
} as const

function serialize(row: {
  id: string
  orderId: string
  paidToAccountId: string
  purchaseFromAccountId: string | null
  roundOffEnabled: boolean
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
  purchaseFromAccount?: { id: string; name: string } | null
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
  const totals = sheetTotals(lines, { roundOffEnabled: row.roundOffEnabled })
  return {
    id: row.id,
    orderId: row.orderId,
    paidToAccountId: row.paidToAccountId,
    paidToAccountName: row.paidToAccount?.name ?? null,
    purchaseFromAccountId: row.purchaseFromAccountId,
    purchaseFromAccountName: row.purchaseFromAccount?.name ?? null,
    customerPaidTo: row.paidToAccountId,
    roundOffEnabled: row.roundOffEnabled,
    roundOff: totals.roundOff,
    lines,
    cost: totals.cost,
    sellingPrice: totals.selling,
    sellingRaw: totals.sellingRaw,
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

  const purchaseFromId = input.purchaseFromAccountId?.trim() || null
  if (purchaseFromId) {
    const vendor = await prisma.financeAccount.findFirst({
      where: {
        id: purchaseFromId,
        active: true,
        OR: [{ type: 'VENDOR' }, { isVendorWallet: true }],
        vendorOutflowSource: { in: ['ORDER_SHEETS', 'BOTH'] },
      },
    })
    if (!vendor) {
      throw new Error(
        'Vendor account not found (or is transactions-only — pick a vendor that uses order sheets)',
      )
    }
  }

  const roundOffEnabled = Boolean(input.roundOffEnabled)

  const prior = await prisma.orderFinance.findUnique({
    where: { orderId: input.orderId },
    include: sheetInclude,
  })

  const row = await prisma.$transaction(async (tx) => {
    const sheet = await tx.orderFinance.upsert({
      where: { orderId: input.orderId },
      create: {
        orderId: input.orderId,
        paidToAccountId: input.paidToAccountId,
        purchaseFromAccountId: purchaseFromId,
        roundOffEnabled,
      },
      update: {
        paidToAccountId: input.paidToAccountId,
        purchaseFromAccountId: purchaseFromId,
        roundOffEnabled,
      },
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
