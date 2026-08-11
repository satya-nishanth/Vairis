import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { guestFromMap, loadGuestMap } from '@/lib/catalogue-admin-guests'
import { normReaction } from '@/lib/catalogue-admin-stats'
import { fetchProductReactionDetails } from '@/lib/catalogue-reactions'

export const dynamic = 'force-dynamic'

const CATEGORY_LABELS: Record<string, string> = {
  RINGS: 'Rings',
  EARRINGS: 'Earrings',
  PENDANTS: 'Pendants',
  BRACELETS: 'Bracelets',
}

function formatWhen(d: Date) {
  return d.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
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
  verticalAlign: 'top',
}

const emptyBox: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#9ca3af',
  background: '#fff',
  border: '1px solid #f3f4f6',
  borderRadius: 8,
  padding: '2rem 1.5rem',
  margin: 0,
}

type Props = { params: Promise<{ productId: string }> }

export default async function CatalogueProductFeedbackPage({ params }: Props) {
  const { productId } = await params

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      itemCode: true,
      category: true,
      description: true,
      images: true,
      stoneType: true,
      caratWeight: true,
      isActive: true,
    },
  })

  if (!product) notFound()

  const [comments, reactions] = await Promise.all([
    prisma.catalogueComment.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    }),
    fetchProductReactionDetails(productId),
  ])

  const guestMap = await loadGuestMap([
    ...comments.map((c) => c.guestUserId),
    ...reactions.map((r) => r.guestUserId),
  ])

  const likes = reactions.filter((r) => normReaction(r.reaction) === 'like')
  const dislikes = reactions.filter((r) => normReaction(r.reaction) === 'dislike')

  return (
    <div className="admin-page">
      <Link
        href="/admin/catalogue/comments"
        style={{ display: 'inline-block', marginBottom: '1rem', fontSize: '0.75rem', color: '#b8963e', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}
      >
        ← All catalogue feedback
      </Link>

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 160, height: 160, background: '#050505', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          {product.images[0] ? (
            <img src={product.images[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(184, 150, 62, 0.35)', fontSize: '2.5rem' }}>V</div>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {CATEGORY_LABELS[product.category] ?? product.category}
            {!product.isActive && ' · Inactive'}
          </p>
          <h1 className="admin-page__title" style={{ margin: '0.25rem 0 0' }}>{product.name}</h1>
          {product.itemCode && (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#9ca3af', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{product.itemCode}</p>
          )}
          {product.stoneType && product.caratWeight != null && (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
              {Number(product.caratWeight)}ctw · {product.stoneType}
            </p>
          )}
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: '#6b7280', maxWidth: 560, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {product.description}
          </p>
        </div>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <p className="admin-stat-card__label">Likes</p>
          <p className="admin-stat-card__value admin-stat-card__value--gold">{likes.length}</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-card__label">Dislikes</p>
          <p className="admin-stat-card__value">{dislikes.length}</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-card__label">Comments</p>
          <p className="admin-stat-card__value">{comments.length}</p>
        </div>
      </div>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '0.75rem', fontWeight: 500, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 1rem' }}>
          Comments ({comments.length})
        </h2>
        {comments.length === 0 ? (
          <p style={emptyBox}>No comments for this product yet.</p>
        ) : (
          <>
          <ul className="admin-cards">
            {comments.map((c) => {
              const guest = guestFromMap(guestMap, c.guestUserId)
              return (
                <li key={c.id} className="admin-card admin-card--no-media">
                  <div className="admin-card__body">
                    <span className="admin-card__title">@{guest.username}</span>
                    {guest.createdAt.getTime() > 0 && (
                      <p className="admin-card__meta">Joined {formatWhen(guest.createdAt)}</p>
                    )}
                    {guest.email !== '—' && <p className="admin-card__meta">{guest.email}</p>}
                    {guest.phone !== '—' && <p className="admin-card__meta">{guest.phone}</p>}
                    <p className="admin-card__meta" style={{ whiteSpace: 'pre-wrap' }}>{c.body}</p>
                    <p className="admin-card__meta">{formatWhen(c.createdAt)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="admin-table-wrap">
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Guest</th>
                  <th style={th}>Contact</th>
                  <th style={th}>Comment</th>
                  <th style={th}>When</th>
                </tr>
              </thead>
              <tbody>
                {comments.map((c) => {
                  const guest = guestFromMap(guestMap, c.guestUserId)
                  return (
                    <tr key={c.id}>
                      <td style={td}>
                        <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>@{guest.username}</span>
                        {guest.createdAt.getTime() > 0 && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af' }}>Joined {formatWhen(guest.createdAt)}</span>
                        )}
                      </td>
                      <td style={td}>
                        {guest.email !== '—' ? (
                          <a href={`mailto:${guest.email}`} style={{ display: 'block', color: '#6b7280', textDecoration: 'none' }}>{guest.email}</a>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>—</span>
                        )}
                        {guest.phone !== '—' && (
                          <a href={`tel:${guest.phone}`} style={{ display: 'block', marginTop: 2, color: '#6b7280', textDecoration: 'none' }}>{guest.phone}</a>
                        )}
                      </td>
                      <td style={{ ...td, color: '#374151', maxWidth: 420, whiteSpace: 'pre-wrap' }}>{c.body}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatWhen(c.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '0.75rem', fontWeight: 500, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 1rem' }}>
          Reactions ({reactions.length}
          {reactions.length >= 500 ? ', showing latest 500' : ''})
        </h2>
        {reactions.length === 0 ? (
          <p style={emptyBox}>No likes or dislikes yet.</p>
        ) : (
          <>
          <ul className="admin-cards">
            {reactions.map((r) => {
              const guest = guestFromMap(guestMap, r.guestUserId)
              const isLike = normReaction(r.reaction) === 'like'
              return (
                <li key={r.id} className="admin-card admin-card--no-media">
                  <div className="admin-card__body">
                    <span className="admin-card__title">@{guest.username}</span>
                    <p className="admin-card__meta">{guest.email}</p>
                    <p className="admin-card__meta">{guest.phone}</p>
                    <p className="admin-card__meta">
                      {isLike ? 'Like' : 'Dislike'} · {formatWhen(r.updatedAt)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="admin-table-wrap">
            <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Guest</th>
                  <th style={th}>Contact</th>
                  <th style={th}>Reaction</th>
                  <th style={th}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {reactions.map((r) => {
                  const guest = guestFromMap(guestMap, r.guestUserId)
                  const isLike = normReaction(r.reaction) === 'like'
                  return (
                    <tr key={r.id}>
                      <td style={{ ...td, fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>@{guest.username}</td>
                      <td style={td}>
                        <span style={{ display: 'block' }}>{guest.email}</span>
                        <span style={{ display: 'block', color: '#9ca3af' }}>{guest.phone}</span>
                      </td>
                      <td style={td}>
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '2px 10px',
                            borderRadius: 999,
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                            background: isLike ? '#fdf8f0' : '#fef2f2',
                            color: isLike ? '#b8963e' : '#dc2626',
                          }}
                        >
                          {isLike ? 'Like' : 'Dislike'}
                        </span>
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatWhen(r.updatedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  )
}
