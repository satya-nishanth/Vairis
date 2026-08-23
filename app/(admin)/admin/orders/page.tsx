import type { OrderStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ORDER_STATUS_META } from '@/lib/orders'
import { AdminGuide } from '@/components/admin/AdminGuide'
import { OrdersWorkbench, type OrdersListRow } from '@/components/admin/OrdersWorkbench'

export const dynamic = 'force-dynamic'

const EXCEPTION_STATUSES: OrderStatus[] = [
  'DELIVERY_FAILED',
  'RETURNING_TO_ORIGIN',
  'RTO_RECEIVED',
  'RETURN_REQUESTED',
  'RETURN_IN_TRANSIT',
  'RETURN_RECEIVED',
  'PAYMENT_EXPIRED',
  'FAILED_OTHER',
  'CANCELLED',
  'REFUNDED',
]

/** Short chip row — rest live under “More filters”. */
const PRIMARY_CHIPS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PAYMENT_CONFIRMED', label: 'Confirmed' },
  { key: 'PREPARING', label: 'Crafting' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'EXCEPTIONS', label: 'Exceptions' },
]

const ALL_STATUS_KEYS = Object.keys(ORDER_STATUS_META) as OrderStatus[]

const orderInclude = {
  items: { select: { productName: true, quantity: true } },
  user: { select: { email: true } },
  children: {
    include: {
      items: { select: { productName: true, quantity: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.OrderInclude

function resolveFilter(statusParam: string | undefined): {
  activeChip: string
  whereStatus: OrderStatus | { in: OrderStatus[] } | undefined
  filterLabel: string | null
} {
  if (!statusParam || statusParam === 'ALL') {
    return { activeChip: 'ALL', whereStatus: undefined, filterLabel: null }
  }
  if (statusParam === 'EXCEPTIONS') {
    return {
      activeChip: 'EXCEPTIONS',
      whereStatus: { in: EXCEPTION_STATUSES },
      filterLabel: 'Exceptions',
    }
  }
  if ((ALL_STATUS_KEYS as string[]).includes(statusParam)) {
    const s = statusParam as OrderStatus
    return {
      activeChip: s,
      whereStatus: s,
      filterLabel: ORDER_STATUS_META[s].label,
    }
  }
  return { activeChip: 'ALL', whereStatus: undefined, filterLabel: null }
}

function mapRow(
  o: {
    id: string
    status: OrderStatus
    grandTotal: { toString(): string } | number
    contactName: string
    contactPhone: string
    createdAt: Date
    user: { email: string }
    items: { productName: string; quantity: number }[]
    children?: {
      id: string
      status: OrderStatus
      grandTotal: { toString(): string } | number
      contactName: string
      contactPhone: string
      createdAt: Date
      items: { productName: string; quantity: number }[]
    }[]
  },
  emailFallback?: string,
): OrdersListRow {
  return {
    id: o.id,
    status: o.status,
    grandTotal: Number(o.grandTotal),
    contactName: o.contactName,
    contactPhone: o.contactPhone,
    createdAt: o.createdAt.toISOString(),
    email: emailFallback ?? o.user.email,
    itemsLabel: o.items.map((i) => `${i.productName} ×${i.quantity}`).join(', '),
    children: (o.children ?? []).map((c) =>
      mapRow(
        { ...c, user: { email: emailFallback ?? o.user.email }, children: [] },
        emailFallback ?? o.user.email,
      ),
    ),
  }
}

/**
 * Root orders only, with children nested.
 * Status filter: root matches OR any child matches (parent still shown with all children).
 */
async function loadOrderGroups(whereStatus: OrderStatus | { in: OrderStatus[] } | undefined) {
  if (!whereStatus) {
    return prisma.order.findMany({
      where: { parentOrderId: null },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  }

  const matching = await prisma.order.findMany({
    where: { status: whereStatus },
    select: { id: true, parentOrderId: true },
    take: 300,
  })
  const rootIds = [...new Set(matching.map((m) => m.parentOrderId ?? m.id))]
  if (rootIds.length === 0) return []

  return prisma.order.findMany({
    where: { id: { in: rootIds }, parentOrderId: null },
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
  })
}

/** Admin order list — Option A card rows with nested parent/child groups. */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const { activeChip, whereStatus, filterLabel } = resolveFilter(status)

  let ordersRaw: Awaited<ReturnType<typeof loadOrderGroups>> = []
  let dbMissing = false

  try {
    ordersRaw = await loadOrderGroups(whereStatus)
  } catch (err) {
    console.error('[admin/orders] query failed', err)
    dbMissing = true
  }

  const orders: OrdersListRow[] = ordersRaw.map((o) => mapRow(o))

  const chips = PRIMARY_CHIPS.map((c) => ({
    key: c.key,
    label: c.label,
    href: c.key === 'ALL' ? '/admin/orders' : `/admin/orders?status=${c.key}`,
  }))

  const primaryKeys = new Set(
    PRIMARY_CHIPS.map((c) => c.key).filter((k) => k !== 'ALL' && k !== 'EXCEPTIONS'),
  )
  const moreStatuses = ALL_STATUS_KEYS.filter((s) => !primaryKeys.has(s)).map((s) => ({
    key: s,
    label: ORDER_STATUS_META[s].label,
    href: `/admin/orders?status=${s}`,
  }))

  return (
    <div className="admin-page admin-page--orders">
      <AdminGuide
        pageKey="orders"
        title="Orders"
        blurb="Full order list + lifecycle (payment → delivery → returns/RTO). Manual Order creates one on a customer's behalf."
        tips={['Status changes here can trigger customer emails — double-check before changing.']}
      />

      {dbMissing && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            color: '#92400e',
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}
        >
          <strong>Database migration required.</strong> Order deposit columns (and related
          tables) are missing on this database. Run{' '}
          <code>scripts/apply-sitebanner-migration-cloud.sql</code> in the Supabase SQL Editor,
          then reload.
        </div>
      )}

      {!dbMissing && (
        <OrdersWorkbench
          orders={orders}
          chips={chips}
          activeChip={activeChip}
          moreStatuses={moreStatuses}
          filterLabel={filterLabel}
        />
      )}
    </div>
  )
}
