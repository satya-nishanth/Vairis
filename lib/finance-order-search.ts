import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { isPendingOrderSheet, sheetTotals } from '@/lib/finance'
import { getOrderItemQuotes } from '@/lib/finance-order-quotes'

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
  _count: { select: { items: true, children: true } },
  finance: {
    select: {
      paidToAccountId: true,
      lines: {
        select: { id: true, kind: true, costPrice: true, sellingPrice: true },
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
} satisfies Prisma.OrderSelect

function mapHit(o: {
  id: string
  contactName: string
  contactPhone: string
  grandTotal: { toString(): string } | number
  status: string
  createdAt: Date
  finance: {
    paidToAccountId: string
    lines: {
      id: string
      kind: string
      costPrice: { toString(): string } | number
      sellingPrice: { toString(): string } | number
    }[]
  } | null
}) {
  return {
    id: o.id,
    contactName: o.contactName,
    contactPhone: o.contactPhone,
    grandTotal: Number(o.grandTotal),
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    hasSheet: Boolean(o.finance),
    sheet: o.finance
      ? {
          paidToAccountId: o.finance.paidToAccountId,
          lines: o.finance.lines.map((l) => ({
            id: l.id,
            kind: l.kind,
            costPrice: Number(l.costPrice),
            sellingPrice: Number(l.sellingPrice),
          })),
        }
      : null,
  }
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

  return orders
    .filter((o) => !isMultiItemParent(o._count.items, o.status, o._count.children))
    .slice(0, take)
    .map(mapHit)
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
      ],
    },
    20,
  )
}

/** Latest orders eligible for an order finance sheet. */
export async function listRecentFinanceOrders(take = 8) {
  return fetchSheetableOrders({}, take)
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
 * Count sheetable orders whose sheet is still pending:
 * non-zero quoted and/or selling price, and zero purchase price.
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
          lines: { select: { kind: true, costPrice: true, sellingPrice: true } },
        },
      },
    },
  })

  const candidates = orders.filter(
    (o) => !isMultiItemParent(o._count.items, o.status, o._count.children),
  )
  if (candidates.length === 0) return 0

  const assessed = await Promise.all(
    candidates.map(async (o) => {
      const totals = o.finance
        ? sheetTotals(
            o.finance.lines.map((l) => ({
              kind: l.kind,
              costPrice: Number(l.costPrice),
              sellingPrice: Number(l.sellingPrice),
            })),
          )
        : { cost: 0, selling: 0, profit: 0 }

      if (totals.cost > 0) return false
      if (totals.selling > 0) return true

      const quotes = await getOrderItemQuotes(o.id)
      const quotedPrice = quotes.reduce((s, q) => s + q.quotedTotal, 0)
      return isPendingOrderSheet({
        purchasePrice: 0,
        sellingPrice: 0,
        quotedPrice,
      })
    }),
  )

  return assessed.filter(Boolean).length
}
