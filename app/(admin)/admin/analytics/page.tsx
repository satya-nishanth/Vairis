import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

async function rangeStats(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const counts = await prisma.analyticsEvent.groupBy({
    by: ['name'],
    where: { createdAt: { gte: since } },
    _count: { id: true },
  })
  const map = Object.fromEntries(counts.map((c) => [c.name, c._count.id]))
  return {
    pageViews: map.page_view ?? 0,
    pdpViews: map.pdp_view ?? 0,
    addToCarts: map.add_to_cart ?? 0,
    checkouts: map.begin_checkout ?? 0,
    purchases: map.purchase ?? 0,
    searches: map.search ?? 0,
  }
}

export default async function AdminAnalyticsPage() {
  // Server component data fetch — Date.now here is fine (react-hooks/purity
  // is a client-render rule and misfires on async server pages).
  // eslint-disable-next-line react-hooks/purity
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [week, month, topViewedRaw, topCartedRaw, searchEvents, revenue30] = await Promise.all([
    rangeStats(7),
    rangeStats(30),
    prisma.analyticsEvent.groupBy({
      by: ['productId'],
      where: { name: 'pdp_view', createdAt: { gte: since30 }, productId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 8,
    }),
    prisma.analyticsEvent.groupBy({
      by: ['productId'],
      where: { name: 'add_to_cart', createdAt: { gte: since30 }, productId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 8,
    }),
    prisma.analyticsEvent.findMany({
      where: { name: 'search', createdAt: { gte: since30 } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { meta: true },
    }),
    prisma.order.aggregate({
      _sum: { grandTotal: true },
      where: {
        createdAt: { gte: since30 },
        status: {
          in: [
            'PAYMENT_CONFIRMED', 'PREPARING', 'SHIPPED', 'OUT_FOR_DELIVERY',
            'DELIVERED', 'DEPOSIT_REFUNDED', 'SPLIT_INTO_DELIVERIES',
          ],
        },
      },
    }),
  ])

  const productIds = [
    ...new Set(
      [...topViewedRaw, ...topCartedRaw].map((r) => r.productId).filter((x): x is string => !!x),
    ),
  ]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, itemCode: true },
  })
  const nameOf = (id: string | null) => {
    const p = products.find((x) => x.id === id)
    return p ? `${p.name}${p.itemCode ? ` (${p.itemCode})` : ''}` : (id ?? '—')
  }

  // Top + zero-result searches from event meta
  const searchCounts = new Map<string, { count: number; zero: boolean }>()
  for (const e of searchEvents) {
    const meta = e.meta as { query?: string; results?: number }
    const q = (meta.query ?? '').toLowerCase()
    if (!q) continue
    const cur = searchCounts.get(q) ?? { count: 0, zero: true }
    cur.count += 1
    if ((meta.results ?? 0) > 0) cur.zero = false
    searchCounts.set(q, cur)
  }
  const topSearches = [...searchCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12)

  const funnel = [
    { label: 'Page views', value: month.pageViews },
    { label: 'Product views', value: month.pdpViews },
    { label: 'Add to cart', value: month.addToCarts },
    { label: 'Checkout started', value: month.checkouts },
    { label: 'Purchases', value: month.purchases },
  ]
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.value))

  const panel = { background: '#fff', border: '1px solid #f3f4f6', borderRadius: 8, padding: 16 } as const

  return (
    <div className="admin-page" style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '1.5rem' }}>
        Analytics
      </h1>

      <div className="admin-stats">
        {[
          { label: 'Purchases (7d)', value: String(week.purchases) },
          { label: 'Purchases (30d)', value: String(month.purchases) },
          { label: 'Revenue (30d)', value: inr(Number(revenue30._sum.grandTotal ?? 0)) },
          {
            label: 'PDP → Cart (30d)',
            value: month.pdpViews > 0 ? `${Math.round((month.addToCarts / month.pdpViews) * 100)}%` : '—',
          },
          {
            label: 'Checkout → Purchase (30d)',
            value: month.checkouts > 0 ? `${Math.round((month.purchases / month.checkouts) * 100)}%` : '—',
          },
          { label: 'Searches (30d)', value: String(month.searches) },
        ].map((s) => (
          <div className="admin-stat-card" key={s.label}>
            <p className="admin-stat-card__label">{s.label}</p>
            <p className="admin-stat-card__value">{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        <div style={panel}>
          <h2 style={{ fontSize: '1rem', marginBottom: 12 }}>Funnel — last 30 days</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {funnel.map((f) => (
              <div key={f.label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 60px', gap: 10, alignItems: 'center', fontSize: '0.8125rem' }}>
                <span>{f.label}</span>
                <div style={{ height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(f.value / maxFunnel) * 100}%`, background: '#b8963e' }} />
                </div>
                <strong>{f.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={panel}>
            <h2 style={{ fontSize: '1rem', marginBottom: 12 }}>Most viewed (30d)</h2>
            {topViewedRaw.length === 0 && <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>No data yet.</p>}
            {topViewedRaw.map((r) => (
              <p key={r.productId} style={{ fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', gap: 8, margin: '4px 0' }}>
                <span>{nameOf(r.productId)}</span>
                <strong>{r._count.id}</strong>
              </p>
            ))}
          </div>
          <div style={panel}>
            <h2 style={{ fontSize: '1rem', marginBottom: 12 }}>Most added to cart (30d)</h2>
            {topCartedRaw.length === 0 && <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>No data yet.</p>}
            {topCartedRaw.map((r) => (
              <p key={r.productId} style={{ fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', gap: 8, margin: '4px 0' }}>
                <span>{nameOf(r.productId)}</span>
                <strong>{r._count.id}</strong>
              </p>
            ))}
          </div>
          <div style={panel}>
            <h2 style={{ fontSize: '1rem', marginBottom: 12 }}>Top searches (30d)</h2>
            {topSearches.length === 0 && <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>No data yet.</p>}
            {topSearches.map(([q, s]) => (
              <p key={q} style={{ fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', gap: 8, margin: '4px 0' }}>
                <span>
                  {q}
                  {s.zero && <span style={{ color: '#dc2626' }}> · no results</span>}
                </span>
                <strong>{s.count}</strong>
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
