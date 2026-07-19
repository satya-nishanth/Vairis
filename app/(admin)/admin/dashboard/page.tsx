import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function AdminDashboard() {
  const [totalProducts, activeProducts, categories] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.groupBy({ by: ['category'], _count: { id: true } }),
  ])

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Dashboard</h1>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <p className="admin-stat-card__label">Total Products</p>
          <p className="admin-stat-card__value">{totalProducts}</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-card__label">Active</p>
          <p className="admin-stat-card__value admin-stat-card__value--gold">{activeProducts}</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-card__label">Categories</p>
          <p className="admin-stat-card__value">{categories.length}</p>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="admin-panel">
          <h2 className="admin-panel__title">By Category</h2>
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
