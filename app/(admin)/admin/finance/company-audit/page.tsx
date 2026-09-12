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
import { getFinanceKpiSettings } from '@/lib/finance-settings'
import {
  collectedByOrderIds,
  collectedByPurchaseBillIds,
  orderPaymentSummary,
  purchaseBillPaymentSummary,
} from '@/lib/finance-collections'
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
  // Default: all time (Reports keep month default via shared parser).
  const hasPeriodParam = Boolean(sp.period || sp.month || sp.quarter || sp.year)
  const period = parseFinanceReportSearchParams(
    hasPeriodParam ? sp : { ...sp, period: 'all' },
  )
  const { start, end } = financeReportDateRange(period)
  const range = start && end ? { start, end } : undefined
  const initialTab = sp.tab === 'reconciliation' ? 'reconciliation' : 'overview'

  const [sheets, accounts, transactions, inventoryItems, inventorySales, purchaseBills, kpiSettings] =
    await Promise.all([
      prisma.orderFinance.findMany({
        include: {
          order: {
            select: {
              id: true,
              createdAt: true,
              contactName: true,
              grandTotal: true,
            },
          },
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
          reviewComplete: true,
          paidThroughAccountId: true,
          transferToAccountId: true,
          unlinkedOrderLabels: true,
          unlinkedInventoryLabels: true,
          categoryId: true,
          category: { select: { id: true, name: true } },
          orders: { select: { orderId: true } },
          inventoryItems: { select: { inventoryItemId: true } },
          allocations: {
            select: { amount: true, orderId: true, purchaseBillId: true },
          },
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
      prisma.purchaseBill.findMany({
        select: {
          id: true,
          billNumber: true,
          supplierName: true,
          date: true,
          totalAmount: true,
          supplierContact: { select: { name: true } },
        },
      }),
      getFinanceKpiSettings(),
    ])

  const yearSet = new Set<number>([period.year, new Date().getFullYear()])
  for (const t of transactions) yearSet.add(t.date.getFullYear())
  for (const s of sheets) yearSet.add(s.order.createdAt.getFullYear())
  for (const b of purchaseBills) yearSet.add(b.date.getFullYear())
  const years = [...yearSet].sort((a, b) => b - a)

  const variantIds = inventoryItems
    .map((r) => r.variantId)
    .filter((id): id is string => id != null)
  const liveByVariantId = await getLiveUnitPricesByVariantId(variantIds)

  const sheetOrderIds = sheets.map((s) => s.orderId)
  const [paidByBill, collectedByOrder] = await Promise.all([
    collectedByPurchaseBillIds(purchaseBills.map((b) => b.id)),
    collectedByOrderIds(sheetOrderIds),
  ])

  const sheetRows = sheets.map((s) => {
    const totals = sheetTotals(
      s.lines.map((l) => ({
        kind: l.kind,
        costPrice: Number(l.costPrice),
        sellingPrice: Number(l.sellingPrice),
      })),
      { roundOffEnabled: s.roundOffEnabled },
    )
    return {
      orderId: s.orderId,
      orderLabel: s.order.contactName || s.orderId,
      orderCreatedAt: s.order.createdAt,
      cost: totals.cost,
      sellingPrice: totals.selling,
      paidToAccountId: s.paidToAccountId,
      grandTotal: Number(s.order.grandTotal),
    }
  })

  const stockRows = inventoryRowsForAudit(inventoryItems)

  const audit = buildCompanyAudit({
    sheets: sheetRows,
    txExpense: transactions.map((t) => ({
      date: t.date,
      direction: t.direction,
      amount: Number(t.amount),
      relatedToOrder:
        t.orders.length > 0 ||
        t.unlinkedOrderLabels.length > 0 ||
        t.allocations.some((a) => a.orderId || a.purchaseBillId),
      categoryId: t.categoryId,
      categoryName: t.category?.name ?? null,
      hasPurchaseBillAllocation: t.allocations.some((a) => a.purchaseBillId),
      hasInventoryLink:
        t.inventoryItems.length > 0 || (t.unlinkedInventoryLabels?.length ?? 0) > 0,
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
      .filter(
        (t) =>
          t.direction === 'INFLOW' &&
          (t.orders.length > 0 || t.allocations.some((a) => a.orderId)),
      )
      .map((t) => {
        const orderAllocs = t.allocations
          .filter((a) => a.orderId)
          .map((a) => ({ orderId: a.orderId!, amount: Number(a.amount) }))
        const fromJoin = t.orders.map((o) => o.orderId)
        const fromAlloc = orderAllocs.map((a) => a.orderId)
        return {
          date: t.date,
          amount: Number(t.amount),
          orderIds: [...new Set([...fromJoin, ...fromAlloc])],
          allocations: orderAllocs.length ? orderAllocs : undefined,
        }
      }),
    auditOutflows: transactions
      .filter((t) => t.direction === 'OUTFLOW')
      .map((t) => ({
        id: t.id,
        date: t.date,
        amount: Number(t.amount),
        relatedToOrder:
          t.orders.length > 0 ||
          t.unlinkedOrderLabels.length > 0 ||
          t.allocations.some((a) => a.orderId || a.purchaseBillId),
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
    purchaseBills: purchaseBills.map((b) => {
      const total = Number(b.totalAmount)
      const paid = paidByBill.get(b.id) ?? 0
      const summary = purchaseBillPaymentSummary(total, paid)
      return {
        id: b.id,
        billNumber: b.billNumber,
        supplierName: b.supplierName || b.supplierContact?.name || '',
        date: b.date,
        total: summary.total,
        paid: summary.paid,
        paymentStatus: summary.paymentStatus,
      }
    }),
    orderPayments: sheetRows.map((s) => {
      const summary = orderPaymentSummary({
        grandTotal: s.grandTotal,
        sheetSelling: s.sellingPrice,
        collected: collectedByOrder.get(s.orderId) ?? 0,
      })
      return {
        orderId: s.orderId,
        label: s.orderLabel,
        orderCreatedAt: s.orderCreatedAt,
        expected: summary.expected,
        collected: summary.collected,
        paymentStatus: summary.paymentStatus,
        grandTotal: s.grandTotal,
        sheetSelling: s.sellingPrice > 0 ? s.sellingPrice : null,
      }
    }),
    txAllocations: transactions.map((t) => {
      let allocatedToOrders = 0
      let allocatedToBills = 0
      for (const a of t.allocations) {
        const amt = Number(a.amount)
        if (a.orderId) allocatedToOrders += amt
        if (a.purchaseBillId) allocatedToBills += amt
      }
      return {
        id: t.id,
        date: t.date,
        direction: t.direction,
        amount: Number(t.amount),
        allocatedAmount: allocatedToOrders + allocatedToBills,
        allocatedToOrders,
        allocatedToBills,
        reviewComplete: t.reviewComplete,
        description: t.description || null,
      }
    }),
    range,
    kpiCategoryConfig: kpiSettings,
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
