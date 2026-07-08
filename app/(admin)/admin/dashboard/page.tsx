import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function AdminDashboard() {
  const [totalProducts, activeProducts, categories] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.groupBy({ by: ['category'], _count: { id: true } }),
  ])

  const statCard: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #f3f4f6',
    borderRadius: '8px',
    padding: '1.5rem',
  }

  const statLabel: React.CSSProperties = {
    fontSize: '0.625rem',
    color: '#9ca3af',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '0.25rem',
  }

  const statValue: React.CSSProperties = {
    fontSize: '2.25rem',
    fontWeight: 400,
    color: '#111827',
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1
        style={{
          fontSize: '1.875rem',
          fontWeight: 400,
          color: '#111827',
          marginBottom: '2rem',
        }}
      >
        Dashboard
      </h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1.5rem',
          marginBottom: '2.5rem',
        }}
      >
        <div style={statCard}>
          <p style={statLabel}>Total Products</p>
          <p style={statValue}>{totalProducts}</p>
        </div>
        <div style={statCard}>
          <p style={statLabel}>Active</p>
          <p style={{ ...statValue, color: '#b8963e' }}>{activeProducts}</p>
        </div>
        <div style={statCard}>
          <p style={statLabel}>Categories</p>
          <p style={statValue}>{categories.length}</p>
        </div>
      </div>

      {categories.length > 0 && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #f3f4f6',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '2.5rem',
          }}
        >
          <h2
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: '#4b5563',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '1rem',
            }}
          >
            By Category
          </h2>
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

      <Link
        href="/admin/products/new"
        style={{
          display: 'inline-block',
          padding: '0.75rem 2rem',
          background: '#032b24',
          color: '#fff',
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textDecoration: 'none',
        }}
      >
        + Add Product
      </Link>
    </div>
  )
}
