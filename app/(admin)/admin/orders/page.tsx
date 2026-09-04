import type { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ORDER_STATUS_META } from '@/lib/orders'
import { AdminGuide } from '@/components/admin/AdminGuide'
import {
  OrdersWorkbench,
  type OrdersListRow,
  type OrdersKpi,
} from '@/components/admin/OrdersWorkbench'

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

const itemSelect = {
  productName: true,
  quantity: true,
  priceBreakdown: true,
  variant: { select: { product: { select: { images: true } } } },
} satisfies Prisma.OrderItemSelect

const orderInclude = {
  items: { select: itemSelect },
  user: { select: { email: true } },
  payment: {
    select: {
      status: true,
      amount: true,
      razorpayPaymentId: true,
      createdAt: true,
    },
  },
  events: {
    select: { id: true, status: true, note: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
  children: {
    include: {
      items: { select: itemSelect },
      payment: {
        select: {
          status: true,
          amount: true,
          razorpayPaymentId: true,
          createdAt: true,
        },
      },
      events: {
        select: { id: true, status: true, note: true, createdAt: true },
        orderBy: { createdAt: 'asc' as const },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.OrderInclude

/** Front image only — skip video assets in the product gallery. */
function frontImage(images: string[]): string | null {
  const src = images.find((u) => !/\.(mp4|webm|mov)(\?|$)/i.test(u)) ?? images[0]
  return src || null
}

type RawItem = {
  productName: string
  quantity: number
  priceBreakdown: unknown
  variant: { product: { images: string[] } }
}

type ChannelFilter = 'all' | 'manual' | 'online'
type GstFilter = 'all' | 'yes' | 'no'

function resolveChannel(param: string | undefined): ChannelFilter {
  if (param === 'manual' || param === 'online') return param
  return 'all'
}

function resolveGst(param: string | undefined): GstFilter {
  if (param === 'yes' || param === 'no') return param
  return 'all'
}

function ordersHref(parts: {
  status?: string
  channel?: ChannelFilter
  gst?: GstFilter
}): string {
  const sp = new URLSearchParams()
  if (parts.status && parts.status !== 'ALL') sp.set('status', parts.status)
  if (parts.channel && parts.channel !== 'all') sp.set('channel', parts.channel)
  if (parts.gst && parts.gst !== 'all') sp.set('gst', parts.gst)
  const q = sp.toString()
  return q ? `/admin/orders?${q}` : '/admin/orders'
}

function itemHasGst(breakdown: unknown): boolean {
  if (!breakdown || typeof breakdown !== 'object') return false
  const gst = (breakdown as { gst?: unknown }).gst
  return typeof gst === 'number' && Number.isFinite(gst) && gst > 0
}

function orderGroupHasGst(o: {
  items: { priceBreakdown: unknown }[]
  children?: { items: { priceBreakdown: unknown }[] }[]
}): boolean {
  if (o.items.some((i) => itemHasGst(i.priceBreakdown))) return true
  return (o.children ?? []).some((c) => c.items.some((i) => itemHasGst(i.priceBreakdown)))
}

type RawPayment = {
  status: PaymentStatus
  amount: { toString(): string } | number
  razorpayPaymentId: string | null
  createdAt: Date
} | null

type RawEvent = {
  id: string
  status: OrderStatus
  note: string | null
  createdAt: Date
}

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
    items: RawItem[]
    payment?: RawPayment
    events?: RawEvent[]
    children?: {
      id: string
      status: OrderStatus
      grandTotal: { toString(): string } | number
      contactName: string
      contactPhone: string
      createdAt: Date
      items: RawItem[]
      payment?: RawPayment
      events?: RawEvent[]
    }[]
  },
  emailFallback?: string,
): OrdersListRow {
  const items = o.items.map((i) => ({
    productName: i.productName,
    quantity: i.quantity,
    imageUrl: frontImage(i.variant.product.images),
  }))
  const payment = o.payment
    ? {
        status: o.payment.status,
        amount: Number(o.payment.amount),
        razorpayPaymentId: o.payment.razorpayPaymentId,
        createdAt: o.payment.createdAt.toISOString(),
      }
    : null

  return {
    id: o.id,
    status: o.status,
    grandTotal: Number(o.grandTotal),
    contactName: o.contactName,
    contactPhone: o.contactPhone,
    createdAt: o.createdAt.toISOString(),
    email: emailFallback ?? o.user.email,
    itemsLabel: o.items.map((i) => `${i.productName} ×${i.quantity}`).join(', '),
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    items,
    payment,
    events: (o.events ?? []).map((e) => ({
      id: e.id,
      status: e.status,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
    children: (o.children ?? []).map((c) =>
      mapRow(
        {
          ...c,
          user: { email: emailFallback ?? o.user.email },
          children: [],
        },
        emailFallback ?? o.user.email,
      ),
    ),
  }
}

/**
 * Root orders only, with children nested.
 * Status filter: root matches OR any child matches (parent still shown with all children).
 * Channel: Payment row present = online; absent = manual/offline.
 * GST: any line (or child line) with priceBreakdown.gst > 0.
 */
async function loadOrderGroups(opts: {
  whereStatus: OrderStatus | { in: OrderStatus[] } | undefined
  channel: ChannelFilter
  gst: GstFilter
}) {
  const paymentWhere: Prisma.OrderWhereInput =
    opts.channel === 'manual'
      ? { payment: { is: null } }
      : opts.channel === 'online'
        ? { payment: { isNot: null } }
        : {}

  let rows
  if (!opts.whereStatus) {
    rows = await prisma.order.findMany({
      where: { parentOrderId: null, ...paymentWhere },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  } else {
    const matching = await prisma.order.findMany({
      where: { status: opts.whereStatus },
      select: { id: true, parentOrderId: true },
      take: 300,
    })
    const rootIds = [...new Set(matching.map((m) => m.parentOrderId ?? m.id))]
    if (rootIds.length === 0) return []

    rows = await prisma.order.findMany({
      where: { id: { in: rootIds }, parentOrderId: null, ...paymentWhere },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  if (opts.gst === 'all') return rows
  return rows.filter((o) => {
    const has = orderGroupHasGst(o)
    return opts.gst === 'yes' ? has : !has
  })
}

async function loadKpis(channel: ChannelFilter, gst: GstFilter): Promise<OrdersKpi[]> {
  // Count every work unit (root singles + child deliveries). Split parents
  // use SPLIT_INTO_DELIVERIES, so they never inflate these buckets.
  const [needsAction, inCrafting, outForDelivery] = await Promise.all([
    prisma.order.count({ where: { status: 'PAYMENT_CONFIRMED' } }),
    prisma.order.count({ where: { status: 'PREPARING' } }),
    prisma.order.count({ where: { status: 'OUT_FOR_DELIVERY' } }),
  ])

  return [
    {
      key: 'PAYMENT_CONFIRMED',
      label: 'Needs action',
      count: needsAction,
      href: ordersHref({ status: 'PAYMENT_CONFIRMED', channel, gst }),
    },
    {
      key: 'PREPARING',
      label: 'In crafting',
      count: inCrafting,
      href: ordersHref({ status: 'PREPARING', channel, gst }),
    },
    {
      key: 'OUT_FOR_DELIVERY',
      label: 'Out for delivery',
      count: outForDelivery,
      href: ordersHref({ status: 'OUT_FOR_DELIVERY', channel, gst }),
    },
  ]
}

/** Admin order list — split table + journey preview. */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; channel?: string; gst?: string }>
}) {
  const sp = await searchParams
  const { activeChip, whereStatus, filterLabel } = resolveFilter(sp.status)
  const channel = resolveChannel(sp.channel)
  const gst = resolveGst(sp.gst)

  let ordersRaw: Awaited<ReturnType<typeof loadOrderGroups>> = []
  let kpis: OrdersKpi[] = []
  let dbMissing = false

  try {
    ;[ordersRaw, kpis] = await Promise.all([
      loadOrderGroups({ whereStatus, channel, gst }),
      loadKpis(channel, gst),
    ])
  } catch (err) {
    console.error('[admin/orders] query failed', err)
    dbMissing = true
  }

  const orders: OrdersListRow[] = ordersRaw.map((o) => mapRow(o))

  const chips = PRIMARY_CHIPS.map((c) => ({
    key: c.key,
    label: c.label,
    href: ordersHref({ status: c.key, channel, gst }),
  }))

  const primaryKeys = new Set(
    PRIMARY_CHIPS.map((c) => c.key).filter((k) => k !== 'ALL' && k !== 'EXCEPTIONS'),
  )
  const moreStatuses = ALL_STATUS_KEYS.filter((s) => !primaryKeys.has(s)).map((s) => ({
    key: s,
    label: ORDER_STATUS_META[s].label,
    href: ordersHref({ status: s, channel, gst }),
  }))

  const channelChips = [
    { key: 'all', label: 'All channels', href: ordersHref({ status: activeChip, channel: 'all', gst }) },
    { key: 'manual', label: 'Manual', href: ordersHref({ status: activeChip, channel: 'manual', gst }) },
    { key: 'online', label: 'Online', href: ordersHref({ status: activeChip, channel: 'online', gst }) },
  ]
  const gstChips = [
    { key: 'all', label: 'All tax', href: ordersHref({ status: activeChip, channel, gst: 'all' }) },
    { key: 'yes', label: 'GST', href: ordersHref({ status: activeChip, channel, gst: 'yes' }) },
    { key: 'no', label: 'No GST', href: ordersHref({ status: activeChip, channel, gst: 'no' }) },
  ]

  const extraLabels = [
    channel === 'manual' ? 'Manual' : channel === 'online' ? 'Online' : null,
    gst === 'yes' ? 'GST' : gst === 'no' ? 'No GST' : null,
    filterLabel,
  ].filter(Boolean) as string[]
  const combinedFilterLabel = extraLabels.length ? extraLabels.join(' · ') : null

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
          channelChips={channelChips}
          activeChannel={channel}
          gstChips={gstChips}
          activeGst={gst}
          filterLabel={combinedFilterLabel}
          kpis={kpis}
        />
      )}
    </div>
  )
}
