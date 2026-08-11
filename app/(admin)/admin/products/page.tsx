import Link from 'next/link'
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import type { Category } from '@prisma/client'
import { AdminGuide } from '@/components/admin/AdminGuide'
import { AdminProductsTable } from '@/components/admin/AdminProductsTable'

export const dynamic = 'force-dynamic'

const CATEGORIES: { key: Category | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'RINGS', label: 'Rings' },
  { key: 'EARRINGS', label: 'Earrings' },
  { key: 'PENDANTS', label: 'Pendants' },
  { key: 'BRACELETS', label: 'Bracelets' },
  { key: 'NECKLACES', label: 'Necklaces' },
]

const ROW_OPTIONS = [10, 25, 50] as const

type PageProps = {
  searchParams: Promise<{ category?: string; status?: string; page?: string; rows?: string }>
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const categoryParam = (params.category ?? 'ALL').toUpperCase()
  const statusParam = (params.status ?? 'all').toLowerCase()

  const rowsRaw = Number(params.rows ?? 10)
  const rows = (ROW_OPTIONS as readonly number[]).includes(rowsRaw) ? rowsRaw : 10
  const pageRaw = Math.max(1, Number(params.page ?? 1) || 1)

  const activeCategory =
    CATEGORIES.some((c) => c.key === categoryParam) ? (categoryParam as Category | 'ALL') : 'ALL'

  const where = {
    ...(activeCategory !== 'ALL' ? { category: activeCategory } : {}),
    ...(statusParam === 'live' ? { status: 'LIVE' as const } : {}),
    ...(statusParam === 'draft' ? { status: 'DRAFT' as const } : {}),
    ...(statusParam === 'ai-draft' ? { status: 'AI_DRAFT' as const } : {}),
  }

  const [filteredTotal, counts] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.groupBy({
      by: ['category'],
      _count: { id: true },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(filteredTotal / rows))
  const page = Math.min(pageRaw, totalPages)

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    include: { variants: true },
    skip: (page - 1) * rows,
    take: rows,
  })

  const countByCategory: Record<string, number> = Object.fromEntries(
    counts.map((c) => [c.category, c._count.id]),
  )
  const totalCount = counts.reduce((n, c) => n + c._count.id, 0)

  const baseQuery = () => {
    const q = new URLSearchParams()
    if (activeCategory !== 'ALL') q.set('category', activeCategory)
    if (statusParam !== 'all') q.set('status', statusParam)
    if (rows !== 10) q.set('rows', String(rows))
    return q
  }

  const tabHref = (key: string) => {
    const q = baseQuery()
    if (key === 'ALL') q.delete('category')
    else q.set('category', key)
    q.delete('page')
    const s = q.toString()
    return s ? `/admin/products?${s}` : '/admin/products'
  }

  const statusHref = (status: string) => {
    const q = baseQuery()
    if (status === 'all') q.delete('status')
    else q.set('status', status)
    q.delete('page')
    const s = q.toString()
    return s ? `/admin/products?${s}` : '/admin/products'
  }

  const newProductHref =
    activeCategory !== 'ALL'
      ? `/admin/products/new?category=${activeCategory}`
      : '/admin/products/new'

  const rowsData = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    itemCode: p.itemCode,
    images: p.images ?? [],
    isActive: p.isActive,
    status: p.status,
    variantCount: p.variants.length,
    mediaCount: (p.images ?? []).filter(Boolean).length,
  }))

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title" style={{ marginBottom: '0.25rem' }}>
            Products
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>
            {filteredTotal} in this view
            {activeCategory !== 'ALL'
              ? ` · ${activeCategory.charAt(0) + activeCategory.slice(1).toLowerCase()}`
              : ''}
            {' · '}
            {totalCount} total
          </p>
        </div>
        <Link href={newProductHref} className="admin-btn">
          + New Product
        </Link>
      </div>
      <AdminGuide
        pageKey="products"
        title="Products"
        blurb="Full catalogue CRUD — draft, AI-draft, or live."
        tips={[
          'Only live products show on the storefront.',
          'Image order (front→left→right→back) controls PDP gallery order.',
        ]}
      />

      <div className="admin-products__filters">
        <div className="admin-products__tabs">
          {CATEGORIES.map((cat) => {
            const count = cat.key === 'ALL' ? totalCount : (countByCategory[cat.key] ?? 0)
            const active = activeCategory === cat.key
            return (
              <Link
                key={cat.key}
                href={tabHref(cat.key)}
                className={active ? 'admin-products__tab is-active' : 'admin-products__tab'}
              >
                {cat.label}
                <span>{count}</span>
              </Link>
            )
          })}
        </div>

        <div className="admin-products__status">
          {[
            { key: 'all', label: 'All statuses' },
            { key: 'live', label: 'Live' },
            { key: 'draft', label: 'Draft' },
            { key: 'ai-draft', label: 'AI Draft' },
          ].map((s) => {
            const active = statusParam === s.key
            return (
              <Link
                key={s.key}
                href={statusHref(s.key)}
                className={active ? 'admin-products__pill is-active' : 'admin-products__pill'}
              >
                {s.label}
              </Link>
            )
          })}
        </div>
      </div>

      {filteredTotal === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem 0', color: '#9ca3af' }}>
          <p style={{ fontSize: '1.5rem', fontWeight: 400, marginBottom: '0.5rem' }}>
            No products in this view
          </p>
          <Link href={newProductHref} style={{ fontSize: '0.875rem', color: '#b8963e' }}>
            Add a product →
          </Link>
        </div>
      ) : (
        <Suspense fallback={<div className="admin-products__loading">Loading…</div>}>
          <AdminProductsTable products={rowsData} total={filteredTotal} page={page} rows={rows} />
        </Suspense>
      )}
    </div>
  )
}
