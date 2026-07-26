import { prisma } from '@/lib/prisma'
import { ReviewModerationCard } from './ReviewModerationCard'

export const dynamic = 'force-dynamic'

export default async function AdminReviewsPage() {
  const reviews = await prisma.review.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
      product: { select: { id: true, name: true, itemCode: true } },
    },
  })

  return (
    <div className="admin-page" style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Reviews
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        New reviews are hidden until approved. Verified = reviewer has a delivered
        order containing the piece.
      </p>
      <div style={{ display: 'grid', gap: 12 }}>
        {reviews.length === 0 && (
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No reviews yet.</p>
        )}
        {reviews.map((r) => (
          <ReviewModerationCard
            key={r.id}
            review={{
              id: r.id,
              rating: r.rating,
              title: r.title,
              body: r.body,
              status: r.status,
              adminReply: r.adminReply,
              verified: r.orderId != null,
              createdAt: r.createdAt.toISOString(),
              authorName: r.user.name,
              authorEmail: r.user.email,
              productName: r.product.name,
              productCode: r.product.itemCode,
            }}
          />
        ))}
      </div>
    </div>
  )
}
