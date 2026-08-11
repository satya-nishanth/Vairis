import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { loadCatalogueFeedbackMaps } from '@/lib/catalogue-admin-stats'

export const dynamic = 'force-dynamic'

const CATEGORY_LABELS: Record<string, string> = {
  RINGS: 'Rings',
  EARRINGS: 'Earrings',
  PENDANTS: 'Pendants',
  BRACELETS: 'Bracelets',
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 16px',
  fontSize: '0.625rem',
  color: '#9ca3af',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontWeight: 500,
  borderBottom: '1px solid #f3f4f6',
  background: '#fafafa',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '0.8125rem',
  color: '#6b7280',
  borderTop: '1px solid #f9fafb',
  verticalAlign: 'middle',
}

export default async function CatalogueCommentsPage() {
  const [products, { commentMap, likeMap, dislikeMap, totalComments, totalLikes, totalDislikes }] =
    await Promise.all([
      prisma.product.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, itemCode: true, category: true, images: true, isActive: true },
      }),
      loadCatalogueFeedbackMaps(),
    ])

  const withFeedback = products.filter(
    (p) => (commentMap[p.id] ?? 0) + (likeMap[p.id] ?? 0) + (dislikeMap[p.id] ?? 0) > 0
  )

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1 className="admin-page__title" style={{ marginBottom: 0 }}>Customer feedback</h1>
      </div>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', maxWidth: 560, marginTop: '-0.5rem', marginBottom: '1.5rem' }}>
        Likes, dislikes, and comments from catalogue guests. Open a product to see full customer details.
      </p>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <p className="admin-stat-card__label">Comments</p>
          <p className="admin-stat-card__value">{totalComments}</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-card__label">Likes</p>
          <p className="admin-stat-card__value admin-stat-card__value--gold">{totalLikes}</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-card__label">Dislikes</p>
          <p className="admin-stat-card__value">{totalDislikes}</p>
        </div>
      </div>

      {withFeedback.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', padding: '3rem 1.25rem', color: '#9ca3af' }}>
          <p style={{ fontSize: '1.125rem', margin: '0 0 0.5rem', color: '#374151' }}>No catalogue feedback yet</p>
          <p style={{ fontSize: '0.875rem', margin: 0 }}>Comments and reactions will appear here once guests use the catalogue.</p>
        </div>
      ) : (
        <>
        <ul className="admin-cards" style={{ marginBottom: '2rem' }}>
          {withFeedback.map((p) => (
            <li key={p.id} className="admin-card">
              <div className="admin-card__media">
                {p.images[0] ? (
                  <img src={p.images[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(184, 150, 62, 0.35)', fontSize: '1.125rem' }}>V</div>
                )}
              </div>
              <div className="admin-card__body">
                <span className="admin-card__title">{p.name}</span>
                <p className="admin-card__meta" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{p.itemCode ?? '—'}</p>
                <p className="admin-card__meta">
                  {CATEGORY_LABELS[p.category] ?? p.category}
                  {!p.isActive && ' · Inactive'}
                </p>
                <p className="admin-card__meta">
                  {likeMap[p.id] ?? 0} likes · {dislikeMap[p.id] ?? 0} dislikes · {commentMap[p.id] ?? 0} comments
                </p>
                <Link href={`/admin/catalogue/comments/${p.id}`} style={{ fontSize: '0.75rem', color: '#b8963e', fontWeight: 500, textDecoration: 'none' }}>
                  View details →
                </Link>
              </div>
            </li>
          ))}
        </ul>
        <div className="admin-table-wrap" style={{ marginBottom: '2rem' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Product</th>
                <th style={th}>Likes</th>
                <th style={th}>Dislikes</th>
                <th style={th}>Comments</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {withFeedback.map((p) => (
                <tr key={p.id}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ position: 'relative', width: 48, height: 48, background: '#050505', flexShrink: 0, overflow: 'hidden', borderRadius: 4 }}>
                        {p.images[0] ? (
                          <img src={p.images[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(184, 150, 62, 0.35)', fontSize: '1.125rem' }}>V</div>
                        )}
                      </div>
                      <div>
                        <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>{p.name}</span>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{p.itemCode ?? '—'}</span>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af' }}>
                          {CATEGORY_LABELS[p.category] ?? p.category}
                          {!p.isActive && ' · Inactive'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{likeMap[p.id] ?? 0}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{dislikeMap[p.id] ?? 0}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{commentMap[p.id] ?? 0}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <Link href={`/admin/catalogue/comments/${p.id}`} style={{ fontSize: '0.75rem', color: '#b8963e', fontWeight: 500, textDecoration: 'none' }}>
                      View details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      <h2 style={{ fontSize: '0.75rem', fontWeight: 500, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 1rem' }}>
        All products ({products.length})
      </h2>
      <ul className="admin-cards">
        {products.map((p) => (
          <li key={p.id} className="admin-card admin-card--no-media">
            <div className="admin-card__body">
              <span className="admin-card__title">{p.name}</span>
              <p className="admin-card__meta">{p.itemCode ?? '—'}</p>
              <p className="admin-card__meta">
                {likeMap[p.id] ?? 0} likes · {dislikeMap[p.id] ?? 0} dislikes · {commentMap[p.id] ?? 0} comments
              </p>
              <Link href={`/admin/catalogue/comments/${p.id}`} style={{ fontSize: '0.75rem', color: '#6b7280', textDecoration: 'none' }}>
                Open
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <div className="admin-table-wrap">
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Product</th>
              <th style={th}>Likes</th>
              <th style={th}>Dislikes</th>
              <th style={th}>Comments</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td style={td}>
                  <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>{p.name}</span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{p.itemCode ?? '—'}</span>
                </td>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{likeMap[p.id] ?? 0}</td>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{dislikeMap[p.id] ?? 0}</td>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{commentMap[p.id] ?? 0}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <Link href={`/admin/catalogue/comments/${p.id}`} style={{ fontSize: '0.75rem', color: '#6b7280', textDecoration: 'none' }}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
