import { prisma } from '@/lib/prisma'
import { requireFinance } from '@/lib/finance-auth'
import {
  financeReportDateRange,
  parseFinanceReportSearchParams,
  sheetTotals,
} from '@/lib/finance'
import { getLiveUnitPricesByVariantId } from '@/lib/inventory-pricing'
import {
  buildCompanyAudit,
  inventoryRowsForAudit,
} from '@/lib/finance-company-audit'
import { CompanyAuditClient } from '@/components/admin/CompanyAuditClient'
import { inventoryDisplayName } from '@/lib/inventory'

export const dynamic = 'force-dynamic'

export default async function CompanyAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string
    period?: string
    quarter?: string
    year?: string
    tab?: string
  }>
}) {
  await requireFinance()
  const sp = await searchParams
  const period = parseFinanceReportSearchParams(sp)
  const { start, end } = financeReportDateRange(period)
  const range = start && end ? { start, end } : undefined
  const initialTab = sp.tab === 'reconciliation' ? 'reconciliation' : 'overview'

  const [sheets, accounts, transactions, inventoryItems, inventorySales] = await Promise.all([
    prisma.orderFinance.findMany({
      include: {
        order: { select: { id: true, createdAt: true, contactName: true } },
        lines: true,
      },
    }),
    prisma.financeAccount.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.financeTransaction.findMany({
      select: {
        id: true,
        date: true,
        direction: true,
        amount: true,
        description: true,
        paidThroughAccountId: true,
        transferToAccountId: true,
        unlinkedOrderLabels: true,
        orders: { select: { orderId: true } },
      },
    }),
    prisma.inventoryItem.findMany({
      select: {
        id: true,
        qtyOnHand: true,
        purchasePrice: true,
        potentialPrice: true,
        variantId: true,
        customName: true,
        product: { select: { name: true } },
        variant: { select: { sku: true, metalType: true, size: true } },
      },
    }),
    prisma.inventorySale.findMany({
      select: {
        id: true,
        inventoryItemId: true,
        qty: true,
        orderId: true,
        unlinkedOrderLabel: true,
        soldAt: true,
        inventoryItem: {
          select: {
            customName: true,
            product: { select: { name: true } },
            variant: { select: { sku: true, metalType: true, size: true } },
          },
        },
      },
      take: 500,
      orderBy: { soldAt: 'desc' },
    }),
  ])

  const yearSet = new Set<number>([period.year, new Date().getFullYear()])
  for (const t of transactions) yearSet.add(t.date.getFullYear())
  for (const s of sheets) yearSet.add(s.order.createdAt.getFullYear())
  const years = [...yearSet].sort((a, b) => b - a)

  const variantIds = inventoryItems
    .map((r) => r.variantId)
    .filter((id): id is string => id != null)
  const liveByVariantId = await getLiveUnitPricesByVariantId(variantIds)

  const sheetRows = sheets.map((s) => {
    const totals = sheetTotals(
      s.lines.map((l) => ({
        kind: l.kind,
        costPrice: Number(l.costPrice),
        sellingPrice: Number(l.sellingPrice),
      })),
    )
    return {
      orderId: s.orderId,
      orderLabel: s.order.contactName || s.orderId,
      orderCreatedAt: s.order.createdAt,
      cost: totals.cost,
      sellingPrice: totals.selling,
      paidToAccountId: s.paidToAccountId,
    }
  })

  const stockRows = inventoryRowsForAudit(inventoryItems)

  const audit = buildCompanyAudit({
    sheets: sheetRows,
    txExpense: transactions.map((t) => ({
      date: t.date,
      direction: t.direction,
      amount: Number(t.amount),
      relatedToOrder: t.orders.length > 0 || t.unlinkedOrderLabels.length > 0,
    })),
    txFlow: transactions.map((t) => ({
      date: t.date,
      direction: t.direction,
      amount: Number(t.amount),
      paidThroughAccountId: t.paidThroughAccountId,
      transferToAccountId: t.transferToAccountId,
    })),
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type })),
    orderInflows: transactions
      .filter((t) => t.direction === 'INFLOW' && t.orders.length > 0)
      .map((t) => ({
        date: t.date,
        amount: Number(t.amount),
        orderIds: t.orders.map((o) => o.orderId),
      })),
    auditInflows: transactions
      .filter((t) => t.direction === 'INFLOW')
      .map((t) => ({
        id: t.id,
        date: t.date,
        amount: Number(t.amount),
        orderIds: t.orders.map((o) => o.orderId),
        unlinkedOrderLabels: t.unlinkedOrderLabels,
      })),
    auditOutflows: transactions
      .filter((t) => t.direction === 'OUTFLOW')
      .map((t) => ({
        id: t.id,
        date: t.date,
        amount: Number(t.amount),
        relatedToOrder: t.orders.length > 0 || t.unlinkedOrderLabels.length > 0,
        description: t.description || null,
      })),
    stockRows,
    sales: inventorySales.map((s) => ({
      id: s.id,
      itemId: s.inventoryItemId,
      itemLabel: inventoryDisplayName(s.inventoryItem),
      qty: s.qty,
      orderId: s.orderId,
      unlinkedOrderLabel: s.unlinkedOrderLabel,
      soldAt: s.soldAt,
    })),
    liveByVariantId,
    range,
  })

  const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  const periodLabel =
    period.mode === 'all'
      ? 'All time'
      : period.mode === 'year'
        ? String(period.year)
        : period.mode === 'quarter'
          ? (() => {
              const [y, q] = period.quarter.split('-')
              return `${y} Q${q}`
            })()
          : (() => {
              const [y, m] = period.month.split('-').map(Number)
              return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`
            })()

  return (
    <CompanyAuditClient
      initialTab={initialTab}
      periodMode={period.mode}
      monthValue={period.month}
      quarterValue={period.quarter}
      yearValue={period.year}
      periodLabel={periodLabel}
      years={years}
      audit={audit}
    />
  )
}
