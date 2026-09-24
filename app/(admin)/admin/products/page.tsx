import Link from 'next/link'
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import type { Category } from '@prisma/client'
import { AdminGuide } from '@/components/admin/AdminGuide'
import { AdminProductsTable } from '@/components/admin/AdminProductsTable'
import { getStoreCategories } from '@/lib/store-categories'
import { sortProductsByPriority, getProductPriority } from '@/lib/product-priorities'

export const dynamic = 'force-dynamic'

const ROW_OPTIONS = [10, 25, 50] as const

type PageProps = {
  searchParams: Promise<{ category?: string; status?: string; page?: string; rows?: string; q?: string }>
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const categoryParam = (params.category ?? 'ALL').toUpperCase()
  const statusParam = (params.status ?? 'all').toLowerCase()
  const searchTerm = (params.q ?? '').trim()

  const rowsRaw = Number(params.rows ?? 10)
  const rows = (ROW_OPTIONS as readonly number[]).includes(rowsRaw) ? rowsRaw : 10
  const pageRaw = Math.max(1, Number(params.page ?? 1) || 1)

  const [storeCategories, counts] = await Promise.all([
    getStoreCategories(),
    prisma.product.groupBy({
      by: ['category'],
      _count: { id: true },
    }).catch(() => []),
  ])

  const categoryTabs = [
    { key: 'ALL', label: 'All' },
    ...storeCategories.map((c) => ({
      key: c.slug.toUpperCase(),
      label: c.name,
    })),
  ]

  const activeCategory =
    categoryTabs.some((c) => c.key === categoryParam) ? categoryParam : 'ALL'

  const currentStoreCategory = storeCategories.find((c) => c.slug.toUpperCase() === activeCategory)
  const isPrismaCategory = ['RINGS', 'EARRINGS', 'PENDANTS', 'BRACELETS', 'NECKLACES'].includes(activeCategory)

  let categoryCondition: any = undefined
  if (activeCategory !== 'ALL') {
    const conditions: any[] = []
    if (isPrismaCategory) {
      conditions.push({ category: activeCategory as Category })
    }
    if (currentStoreCategory?.productIds && currentStoreCategory.productIds.length > 0) {
      conditions.push({ id: { in: currentStoreCategory.productIds } })
    }
    if (conditions.length === 1) {
      categoryCondition = conditions[0]
    } else if (conditions.length > 1) {
      categoryCondition = { OR: conditions }
    } else {
      categoryCondition = { id: 'no-match' }
    }
  }

  const where = {
    ...(categoryCondition ?? {}),
    ...(statusParam === 'live' ? { status: 'LIVE' as const } : {}),
    ...(statusParam === 'draft' ? { status: 'DRAFT' as const } : {}),
    ...(statusParam === 'ai-draft' ? { status: 'AI_DRAFT' as const } : {}),
    ...(searchTerm
      ? {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' as const } },
            { itemCode: { contains: searchTerm, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const allFilteredProducts = await prisma.product.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      variants: true,
      stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
    },
  }).catch(() => [])

  const sortedProducts = sortProductsByPriority(allFilteredProducts)
  const filteredTotal = sortedProducts.length
  const totalPages = Math.max(1, Math.ceil(filteredTotal / rows))
  const page = Math.min(pageRaw, totalPages)
  const products = sortedProducts.slice((page - 1) * rows, page * rows)

  const countByCategory: Record<string, number> = Object.fromEntries(
    counts.map((c) => [c.category, c._count.id]),
  )
  const totalCount = counts.reduce((n, c) => n + c._count.id, 0)

  const baseQuery = () => {
    const q = new URLSearchParams()
    if (activeCategory !== 'ALL') q.set('category', activeCategory)
    if (statusParam !== 'all') q.set('status', statusParam)
    if (rows !== 10) q.set('rows', String(rows))
    if (searchTerm) q.set('q', searchTerm)
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
    priority: getProductPriority(p.id, (p as any).priority),
    variantCount: p.variants.length,
    mediaCount: (p.images ?? []).filter(Boolean).length,
    description: p.description ?? '',
    designStyle: p.designStyle ?? null,
    stoneType: p.stoneType ?? null,
    stoneShape: p.stoneShape ?? null,
    caratWeight: p.caratWeight ? Number(p.caratWeight) : null,
    gemCount: p.gemCount ?? null,
    stoneDimMm: p.stoneDimMm ?? null,
    totalLengthMm: p.totalLengthMm ? Number(p.totalLengthMm) : null,
    motifSizeMm: p.motifSizeMm ? Number(p.motifSizeMm) : null,
    thicknessMm: p.thicknessMm ? Number(p.thicknessMm) : null,
    metals: Array.from(new Set(p.variants.map((v) => v.metalType))),
    variantsList: p.variants.map((v) => ({
      metalType: v.metalType,
      sku: v.sku,
      size: v.size,
      weightGrams: Number(v.weightGrams),
      stock: v.stock,
    })),
    stonesList: (p.stones ?? []).map((s) => ({
      label: s.label || s.diamondRate?.label || 'Diamond',
      caratWeight: Number(s.caratWeight),
      count: s.count,
    })),
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
          {categoryTabs.map((cat) => {
            const count =
              cat.key === 'ALL'
                ? totalCount
                : (countByCategory[cat.key] ??
                  storeCategories.find((sc) => sc.slug.toUpperCase() === cat.key)?.productIds?.length ??
                  0)
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

        <form
          method="GET"
          action="/admin/products"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}
        >
          {activeCategory !== 'ALL' && <input type="hidden" name="category" value={activeCategory} />}
          {statusParam !== 'all' && <input type="hidden" name="status" value={statusParam} />}
          {rows !== 10 && <input type="hidden" name="rows" value={rows} />}
          <input
            type="search"
            name="q"
            defaultValue={searchTerm}
            placeholder="Search by name or item code…"
            style={{
              flex: '1 1 260px',
              maxWidth: 320,
              padding: '8px 10px',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              fontSize: '0.8125rem',
            }}
          />
          <button
            type="submit"
            className="admin-btn"
            style={{ padding: '8px 14px', fontSize: '0.75rem' }}
          >
            Search
          </button>
          {searchTerm && (
            <Link
              href={(() => {
                const q = baseQuery()
                q.delete('q')
                const s = q.toString()
                return s ? `/admin/products?${s}` : '/admin/products'
              })()}
              style={{ fontSize: '0.75rem', color: '#6b7280', textDecoration: 'none' }}
            >
              Clear
            </Link>
          )}
        </form>
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
