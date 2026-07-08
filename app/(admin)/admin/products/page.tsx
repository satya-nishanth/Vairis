import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: { variants: true },
  })

  return (
    <div style={{ padding: '1rem 2rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
        }}
      >
        <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827' }}>Products</h1>
        <Link
          href="/admin/products/new"
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

      {products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem 0', color: '#9ca3af' }}>
          <p style={{ fontSize: '1.5rem', fontWeight: 400, marginBottom: '0.5rem' }}>No products yet</p>
          <Link href="/admin/products/new" style={{ fontSize: '0.875rem', color: '#b8963e' }}>
            Add your first product →
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
                {['Product', 'Category', 'Item Code', 'Variants', 'Status', ''].map((h) => (
                  <th
                    key={h}
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
              {products.map((p, i) => (
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
                      <span style={{ fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>{p.name}</span>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
