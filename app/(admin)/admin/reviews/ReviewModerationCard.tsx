'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ReviewData = {
  id: string
  rating: number
  title: string | null
  body: string
  status: 'PENDING' | 'APPROVED' | 'HIDDEN'
  adminReply: string | null
  verified: boolean
  createdAt: string
  authorName: string
  authorEmail: string
  productName: string
  productCode: string | null
}

export function ReviewModerationCard({ review }: { review: ReviewData }) {
  const router = useRouter()
  const [reply, setReply] = useState(review.adminReply ?? '')
  const [busy, setBusy] = useState(false)

  async function patch(data: Record<string, unknown>) {
    setBusy(true)
    await fetch(`/api/admin/reviews/${review.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setBusy(false)
    router.refresh()
  }

  const badge =
    review.status === 'APPROVED'
      ? 'admin-products__badge is-active'
      : review.status === 'PENDING'
        ? 'admin-products__badge is-ai'
        : 'admin-products__badge'

  return (
    <div
      style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 8, padding: 16, display: 'grid', gap: 8 }}
      data-testid="review-card"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.875rem' }}>
          {'★'.repeat(review.rating)}
          {'☆'.repeat(5 - review.rating)} {review.title ?? ''}
          <span className={badge} style={{ marginLeft: 8 }}>{review.status}</span>
          {review.verified && (
            <span className="admin-products__badge is-active" style={{ marginLeft: 6 }}>
              Verified
            </span>
          )}
        </strong>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
      <p style={{ fontSize: '0.8125rem', color: '#374151', whiteSpace: 'pre-wrap' }}>{review.body}</p>
      <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
        {review.authorName} ({review.authorEmail}) · {review.productName}
        {review.productCode ? ` · ${review.productCode}` : ''}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {review.status !== 'APPROVED' && (
          <button type="button" className="admin-btn" disabled={busy} onClick={() => patch({ status: 'APPROVED' })}>
            Approve
          </button>
        )}
        {review.status !== 'HIDDEN' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ status: 'HIDDEN' })}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 12px', fontSize: '0.8125rem', cursor: 'pointer', color: '#6b7280' }}
          >
            Hide
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Public reply from VAIRIS (optional)"
          style={{ flex: 1, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '0.8125rem' }}
        />
        <button
          type="button"
          disabled={busy || reply === (review.adminReply ?? '')}
          onClick={() => patch({ adminReply: reply })}
          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 12px', fontSize: '0.8125rem', cursor: 'pointer', color: '#b8963e' }}
        >
          Save reply
        </button>
      </div>
    </div>
  )
}
