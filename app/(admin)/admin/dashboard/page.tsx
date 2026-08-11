import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { AdminGuide } from '@/components/admin/AdminGuide'

export const dynamic = 'force-dynamic'

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export default async function AdminDashboard() {
  const now = new Date()
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(dayStart)
  weekStart.setDate(weekStart.getDate() - 6)

  const REVENUE_STATUSES = [
    'PAYMENT_CONFIRMED',
    'PREPARING',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'DEPOSIT_REFUNDED',
    'SPLIT_INTO_DELIVERIES',
  ] as const

  const [
    totalProducts,
    liveProducts,
    categories,
    ordersToday,
    ordersWeek,
    revenueWeek,
    pendingPayment,
    inFlight,
    returnsOpen,
    refundsInitiated,
    lowStock,
    contactNew,
    reviewsPending,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { status: 'LIVE', isActive: true } }),
    prisma.product.groupBy({ by: ['category'], _count: { id: true } }),
    prisma.order.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.order.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.order.aggregate({
      _sum: { grandTotal: true },
      where: { createdAt: { gte: weekStart }, status: { in: [...REVENUE_STATUSES] } },
    }),
    prisma.order.count({ where: { status: 'PAYMENT_PENDING' } }),
    prisma.order.count({
      where: { status: { in: ['PREPARING', 'SHIPPED', 'OUT_FOR_DELIVERY'] } },
    }),
    prisma.order.count({
      where: { status: { in: ['RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'RETURN_RECEIVED'] } },
    }),
    prisma.orderRefund.count({ where: { status: 'INITIATED' } }),
    prisma.productVariant.count({ where: { stock: { lte: 1 }, product: { status: 'LIVE' } } }),
    prisma.contactRequest.count({ where: { status: 'NEW' } }),
    prisma.review.count({ where: { status: 'PENDING' } }),
  ])

  const stats: { label: string; value: string; href?: string; warn?: boolean }[] = [
    { label: 'Orders Today', value: String(ordersToday), href: '/admin/orders' },
    { label: 'Orders (7 days)', value: String(ordersWeek), href: '/admin/orders' },
    { label: 'Revenue (7 days)', value: inr(Number(revenueWeek._sum.grandTotal ?? 0)) },
    { label: 'Awaiting Payment', value: String(pendingPayment), href: '/admin/orders?status=PAYMENT_PENDING' },
    { label: 'In Fulfilment', value: String(inFlight), href: '/admin/orders' },
    { label: 'Open Returns', value: String(returnsOpen), href: '/admin/orders', warn: returnsOpen > 0 },
    { label: 'Refunds In Flight', value: String(refundsInitiated), warn: refundsInitiated > 0 },
    { label: 'Low Stock (≤1)', value: String(lowStock), href: '/admin/products', warn: lowStock > 0 },
    { label: 'New Contact Requests', value: String(contactNew), warn: contactNew > 0 },
    { label: 'Reviews Pending', value: String(reviewsPending), href: '/admin/reviews', warn: reviewsPending > 0 },
    { label: 'Live Products', value: `${liveProducts}/${totalProducts}`, href: '/admin/products' },
    { label: 'Categories', value: String(categories.length) },
  ]

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Dashboard</h1>
      <AdminGuide
        pageKey="dashboard"
        title="Dashboard"
        blurb="At-a-glance store health — orders, revenue, low stock."
        tips={['Numbers refresh on page load, not live.']}
      />

      <div className="admin-stats">
        {stats.map((s) => {
          const card = (
            <div className="admin-stat-card" key={s.label}>
              <p className="admin-stat-card__label">{s.label}</p>
              <p
                className={
                  s.warn
                    ? 'admin-stat-card__value admin-stat-card__value--gold'
                    : 'admin-stat-card__value'
                }
              >
                {s.value}
              </p>
            </div>
          )
          return s.href ? (
            <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
              {card}
            </Link>
          ) : (
            card
          )
        })}
      </div>

      {categories.length > 0 && (
        <div className="admin-panel">
          <h2 className="admin-panel__title">Products by Category</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {categories.map((c) => (
              <div
                key={c.category}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                  {c.category.charAt(0) + c.category.slice(1).toLowerCase()}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>
                  {c._count.id}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link href="/admin/products/new" className="admin-btn admin-btn--block">
        + Add Product
      </Link>
    </div>
  )
}
