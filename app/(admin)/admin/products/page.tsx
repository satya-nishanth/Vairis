import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import type { Category } from '@prisma/client'

export const dynamic = 'force-dynamic'

const CATEGORIES: { key: Category | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'RINGS', label: 'Rings' },
  { key: 'EARRINGS', label: 'Earrings' },
  { key: 'PENDANTS', label: 'Pendants' },
  { key: 'BRACELETS', label: 'Bracelets' },
  { key: 'NECKLACES', label: 'Necklaces' },
]

type PageProps = {
  searchParams: Promise<{ category?: string; status?: string }>
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const categoryParam = (params.category ?? 'ALL').toUpperCase()
  const statusParam = (params.status ?? 'all').toLowerCase()

  const activeCategory =
    CATEGORIES.some((c) => c.key === categoryParam) ? (categoryParam as Category | 'ALL') : 'ALL'

  const [products, counts] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...(activeCategory !== 'ALL' ? { category: activeCategory } : {}),
        ...(statusParam === 'active' ? { isActive: true } : {}),
        ...(statusParam === 'draft' ? { isActive: false } : {}),
      },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
      include: { variants: true },
    }),
    prisma.product.groupBy({
      by: ['category'],
      _count: { id: true },
    }),
  ])

  const countByCategory: Record<string, number> = Object.fromEntries(
    counts.map((c) => [c.category, c._count.id])
  )
  const totalCount = counts.reduce((n, c) => n + c._count.id, 0)

  const tabHref = (key: string) => {
    const q = new URLSearchParams()
    if (key !== 'ALL') q.set('category', key)
    if (statusParam !== 'all') q.set('status', statusParam)
    const s = q.toString()
    return s ? `/admin/products?${s}` : '/admin/products'
  }

  const statusHref = (status: string) => {
    const q = new URLSearchParams()
    if (activeCategory !== 'ALL') q.set('category', activeCategory)
    if (status !== 'all') q.set('status', status)
    const s = q.toString()
    return s ? `/admin/products?${s}` : '/admin/products'
  }

  const newProductHref =
    activeCategory !== 'ALL'
      ? `/admin/products/new?category=${activeCategory}`
      : '/admin/products/new'

  return (
    <div style={{ padding: '1rem 2rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', margin: 0 }}>
            Products
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0.25rem 0 0' }}>
            {products.length} shown
            {activeCategory !== 'ALL' ? ` in ${activeCategory.charAt(0) + activeCategory.slice(1).toLowerCase()}` : ''}
            {' · '}
            {totalCount} total
          </p>
        </div>
        <Link
          href={newProductHref}
          style={{
            padding: '0.625rem 1.5rem',
            background: '#032b24',
            color: '#fff',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          + New Product
        </Link>
      </div>

      {/* Category tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.375rem',
          flexWrap: 'wrap',
          marginBottom: '0.75rem',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '0.75rem',
        }}
      >
        {CATEGORIES.map((cat) => {
          const count = cat.key === 'ALL' ? totalCount : (countByCategory[cat.key] ?? 0)
          const active = activeCategory === cat.key
          return (
            <Link
              key={cat.key}
              href={tabHref(cat.key)}
              style={{
                padding: '0.5rem 0.875rem',
                fontSize: '0.75rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                borderRadius: '6px',
                border: active ? '1px solid #032b24' : '1px solid #e5e7eb',
                background: active ? '#032b24' : '#fff',
                color: active ? '#fff' : '#4b5563',
                fontWeight: active ? 500 : 400,
              }}
            >
              {cat.label}
              <span
                style={{
                  marginLeft: '0.4rem',
                  opacity: 0.75,
                  fontSize: '0.6875rem',
                }}
              >
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {[
          { key: 'all', label: 'All statuses' },
          { key: 'active', label: 'Active' },
          { key: 'draft', label: 'Draft' },
        ].map((s) => {
          const active = statusParam === s.key
          return (
            <Link
              key={s.key}
              href={statusHref(s.key)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.6875rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                borderRadius: '9999px',
                background: active ? '#fdf8f0' : 'transparent',
                color: active ? '#b8963e' : '#9ca3af',
                border: active ? '1px solid #e8d5a8' : '1px solid transparent',
              }}
            >
              {s.label}
            </Link>
          )
        })}
      </div>

      {products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem 0', color: '#9ca3af' }}>
          <p style={{ fontSize: '1.5rem', fontWeight: 400, marginBottom: '0.5rem' }}>
            No products in this view
          </p>
          <Link href={newProductHref} style={{ fontSize: '0.875rem', color: '#b8963e' }}>
            Add a product →
          </Link>
        </div>
      ) : (
        <div
          style={{
            background: '#fff',
            border: '1px solid #f3f4f6',
            borderRadius: '8px',
            overflow: 'hidden',
            overflowX: 'auto',
          }}
        >
          <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                {['Product', 'Category', 'Item Code', 'Media', 'Variants', 'Status', ''].map((h) => (
                  <th
                    key={h || 'actions'}
                    style={{
                      textAlign: h === '' ? 'right' : 'left',
                      padding: '0.75rem 1.5rem',
                      fontSize: '0.625rem',
                      color: '#9ca3af',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => {
                const mediaCount = (p.images ?? []).filter(Boolean).length
                return (
                  <tr
                    key={p.id}
                    style={{ borderTop: i === 0 ? 'none' : '1px solid #f9fafb' }}
                  >
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            background: '#fdf8f0',
                            flexShrink: 0,
                            overflow: 'hidden',
                            position: 'relative',
                            borderRadius: '2px',
                          }}
                        >
                          {p.images[0] ? (
                            <Image src={p.images[0]} alt={p.name} fill style={{ objectFit: 'cover' }} />
                          ) : (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'rgba(184,150,62,0.3)',
                                fontSize: '1.125rem',
                              }}
                            >
                              V
                            </div>
                          )}
                        </div>
                        <span style={{ fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>
                          {p.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      {p.category.charAt(0) + p.category.slice(1).toLowerCase()}
                    </td>
                    <td
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.875rem',
                        color: '#9ca3af',
                        fontFamily: 'monospace',
                      }}
                    >
                      {p.itemCode ?? '—'}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: mediaCount ? '#6b7280' : '#dc2626' }}>
                      {mediaCount}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      {p.variants.length}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: p.isActive ? '#f0fdf4' : '#f3f4f6',
                          color: p.isActive ? '#15803d' : '#6b7280',
                        }}
                      >
                        {p.isActive ? 'Active' : 'Draft'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <Link
                        href={`/admin/products/${p.id}/edit`}
                        style={{ fontSize: '0.75rem', color: '#b8963e', textDecoration: 'none' }}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
