import { prisma } from '@/lib/prisma'
import type { FinanceLineKind, Prisma } from '@prisma/client'
import { isPendingOrderSheet, sheetTotals } from '@/lib/finance'
import { collectedByOrderIds, orderPaymentSummary } from '@/lib/finance-collections'

/**
 * Order sheets are per delivery / line — hide multi-item parents:
 * - SPLIT_INTO_DELIVERIES parents (items moved to children)
 * - parents that still own ≥2 line items (not yet paid/split)
 * Children and single-item orders remain eligible.
 */
function isMultiItemParent(itemCount: number, status: string, childCount: number) {
  if (status === 'SPLIT_INTO_DELIVERIES' || childCount > 0) return true
  return itemCount > 1
}

const hitSelect = {
  id: true,
  contactName: true,
  contactPhone: true,
  grandTotal: true,
  status: true,
  createdAt: true,
  parentOrderId: true,
  items: { select: { productName: true, quantity: true }, take: 4 },
  _count: { select: { items: true, children: true } },
  finance: {
    select: {
      paidToAccountId: true,
      paidToAccount: { select: { name: true } },
      lines: {
        select: { id: true, kind: true, costPrice: true, sellingPrice: true },
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
} satisfies Prisma.OrderSelect

/** Shared select for order hits (sheets + allocation). */
export const financeOrderHitSelect = hitSelect

function itemsLabel(
  items: { productName: string; quantity: number }[],
  itemCount: number,
): string {
  if (items.length === 0) return '—'
  if (items.length === 1) {
    const i = items[0]
    return i.quantity > 1 ? `${i.productName} ×${i.quantity}` : i.productName
  }
  const first = items[0].productName
  const more = Math.max(0, itemCount - 1)
  return more > 0 ? `${first} +${more} more` : first
}

export type FinanceOrderHit = {
  id: string
  contactName: string
  contactPhone: string
  grandTotal: number
  status: string
  createdAt: string
  itemsLabel: string
  hasSheet: boolean
  sheetComplete: boolean
  purchasing: number | null
  selling: number | null
  profit: number | null
  paidToAccountName: string | null
  /** Allocated inflows toward this order. */
  collected: number
  expected: number
  balance: number
  paymentStatus: 'unpaid' | 'partial' | 'settled' | 'overpaid'
  parentOrderId: string | null
  childCount: number
  /** parent = has children or SPLIT; child = has parentOrderId; else standalone */
  orderKind: 'standalone' | 'parent' | 'child'
  sheet: {
    paidToAccountId: string
    lines: {
      id: string
      kind: string
      costPrice: number
      sellingPrice: number
    }[]
  } | null
}

export function mapFinanceOrderHit(o: {
  id: string
  contactName: string
  contactPhone: string
  grandTotal: { toString(): string } | number
  status: string
  createdAt: Date
  parentOrderId: string | null
  items: { productName: string; quantity: number }[]
  _count: { items: number; children: number }
  finance: {
    paidToAccountId: string
    paidToAccount: { name: string }
    lines: {
      id: string
      kind: string
      costPrice: { toString(): string } | number
      sellingPrice: { toString(): string } | number
    }[]
  } | null
}): FinanceOrderHit {
  const lines = o.finance
    ? o.finance.lines.map((l) => ({
        id: l.id,
        kind: l.kind,
        costPrice: Number(l.costPrice),
        sellingPrice: Number(l.sellingPrice),
      }))
    : null

  const totals = lines
    ? sheetTotals(
        lines.map((l) => ({
          kind: l.kind as FinanceLineKind,
          costPrice: l.costPrice,
          sellingPrice: l.sellingPrice,
        })),
      )
    : null

  const payment = orderPaymentSummary({
    grandTotal: Number(o.grandTotal),
    sheetSelling: totals?.selling ?? null,
    collected: 0,
  })

  const isChild = Boolean(o.parentOrderId)
  const isParent =
    o._count.children > 0 || o.status === 'SPLIT_INTO_DELIVERIES' || (!isChild && o._count.items > 1)

  return {
    id: o.id,
    contactName: o.contactName,
    contactPhone: o.contactPhone,
    grandTotal: Number(o.grandTotal),
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    itemsLabel: itemsLabel(o.items, o._count.items),
    hasSheet: Boolean(o.finance),
    sheetComplete: !isPendingOrderSheet(lines),
    purchasing: totals ? totals.cost : null,
    selling: totals ? totals.selling : null,
    profit: totals ? totals.profit : null,
    paidToAccountName: o.finance?.paidToAccount.name ?? null,
    collected: payment.collected,
    expected: payment.expected,
    balance: payment.balance,
    paymentStatus: payment.paymentStatus,
    parentOrderId: o.parentOrderId,
    childCount: o._count.children,
    orderKind: isChild ? 'child' : isParent ? 'parent' : 'standalone',
    sheet: o.finance
      ? {
          paidToAccountId: o.finance.paidToAccountId,
          lines: lines!,
        }
      : null,
  }
}

export async function attachFinanceOrderPayments(
  hits: FinanceOrderHit[],
  opts?: { excludeTransactionId?: string },
): Promise<FinanceOrderHit[]> {
  const collected = await collectedByOrderIds(
    hits.map((h) => h.id),
    opts?.excludeTransactionId ? { excludeTransactionId: opts.excludeTransactionId } : undefined,
  )
  return hits.map((h) => {
    const payment = orderPaymentSummary({
      grandTotal: h.grandTotal,
      sheetSelling: h.selling,
      collected: collected.get(h.id) ?? 0,
    })
    return { ...h, ...payment }
  })
}

async function fetchSheetableOrders(where: Prisma.OrderWhereInput, take: number) {
  // Over-fetch then drop multi-item parents — Prisma has no clean "item count ≤ 1" filter.
  const batch = Math.max(take * 4, 32)
  const orders = await prisma.order.findMany({
    where: {
      AND: [where, { status: { not: 'SPLIT_INTO_DELIVERIES' }, children: { none: {} } }],
    },
    take: batch,
    orderBy: { createdAt: 'desc' },
    select: hitSelect,
  })

  const hits = orders
    .filter((o) => !isMultiItemParent(o._count.items, o.status, o._count.children))
    .slice(0, take)
    .map(mapFinanceOrderHit)
  return attachFinanceOrderPayments(hits)
}

/** Shared order search for finance UI (API + server page). */
export async function searchFinanceOrders(q: string) {
  const trimmed = q.trim()
  if (trimmed.length < 2) return []

  return fetchSheetableOrders(
    {
      OR: [
        { id: { contains: trimmed, mode: 'insensitive' } },
        { contactName: { contains: trimmed, mode: 'insensitive' } },
        { contactPhone: { contains: trimmed } },
        { user: { email: { contains: trimmed, mode: 'insensitive' } } },
        { items: { some: { productName: { contains: trimmed, mode: 'insensitive' } } } },
      ],
    },
    40,
  )
}

/** Latest orders eligible for an order finance sheet. */
export async function listRecentFinanceOrders(take = 40) {
  return fetchSheetableOrders({}, take)
}

/** Cash allocation: children + standalone only (never split parents). */
async function fetchAllocatableOrders(
  where: Prisma.OrderWhereInput,
  take: number,
  opts?: { excludeTransactionId?: string },
) {
  const orders = await prisma.order.findMany({
    where: {
      AND: [
        where,
        { children: { none: {} } },
        { status: { not: 'SPLIT_INTO_DELIVERIES' } },
      ],
    },
    take,
    orderBy: { createdAt: 'desc' },
    select: hitSelect,
  })
  return attachFinanceOrderPayments(
    orders.map(mapFinanceOrderHit).filter((h) => h.orderKind !== 'parent'),
    opts,
  )
}

const allocSearchWhere = (trimmed: string): Prisma.OrderWhereInput => ({
  OR: [
    { id: { contains: trimmed, mode: 'insensitive' } },
    { contactName: { contains: trimmed, mode: 'insensitive' } },
    { contactPhone: { contains: trimmed } },
    { user: { email: { contains: trimmed, mode: 'insensitive' } } },
    { items: { some: { productName: { contains: trimmed, mode: 'insensitive' } } } },
    // Match child deliveries when searching a parent order id
    { parent: { id: { contains: trimmed, mode: 'insensitive' } } },
  ],
})

/** Order search for cashbook allocation — parent containers excluded. */
export async function searchFinanceOrdersForAllocation(
  q: string,
  opts?: { excludeTransactionId?: string },
) {
  const trimmed = q.trim()
  if (trimmed.length < 2) return []
  return fetchAllocatableOrders(allocSearchWhere(trimmed), 40, opts)
}

export async function listRecentFinanceOrdersForAllocation(
  take = 40,
  opts?: { excludeTransactionId?: string },
) {
  return fetchAllocatableOrders({}, take, opts)
}

/** Statuses that should have a finance sheet filled (paid / in fulfilment). */
const SHEET_EXPECTED_STATUSES = [
  'PAYMENT_CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERY_FAILED',
  'RETURNING_TO_ORIGIN',
  'RTO_RECEIVED',
  'DELIVERED',
  'DEPOSIT_REFUNDED',
  'RETURN_REQUESTED',
  'RETURN_IN_TRANSIT',
  'RETURN_RECEIVED',
  'REFUNDED',
  'FAILED_OTHER',
] as const

/**
 * Count sheetable orders whose sheet is incomplete:
 * missing sheet, or any selling line still has zero purchase price.
 */
export async function countPendingOrderSheets(): Promise<number> {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: [...SHEET_EXPECTED_STATUSES] },
      children: { none: {} },
    },
    select: {
      id: true,
      status: true,
      _count: { select: { items: true, children: true } },
      finance: {
        select: {
          lines: { select: { costPrice: true, sellingPrice: true } },
        },
      },
    },
  })

  return orders.filter((o) => {
    if (isMultiItemParent(o._count.items, o.status, o._count.children)) return false
    const lines = o.finance
      ? o.finance.lines.map((l) => ({
          costPrice: Number(l.costPrice),
          sellingPrice: Number(l.sellingPrice),
        }))
      : null
    return isPendingOrderSheet(lines)
  }).length
}
