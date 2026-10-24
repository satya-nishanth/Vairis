'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { QuotationStatus } from '@prisma/client'

export function QuotationActions({ id, status }: { id: string; status: QuotationStatus }) {
  const router = useRouter()
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function patch(body: Record<string, unknown>) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/quotations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Action failed')
        return
      }
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {status === 'QUOTED' && (
        <Link href={`/admin/orders/new?quotationId=${id}`} className="admin-btn">
          Convert to Order
        </Link>
      )}

      {status === 'REQUESTED' && !showQuoteForm && (
        <button type="button" className="admin-btn" onClick={() => setShowQuoteForm(true)}>
          Mark Quoted
        </button>
      )}

      {status === 'REQUESTED' && showQuoteForm && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '1rem', minWidth: 260 }}>
          <label style={{ display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>
            Quoted amount (₹, optional)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: '100%', border: '1px solid #d1d5db', padding: '6px 8px', marginBottom: 8 }}
          />
          <label style={{ display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>
            Notes (optional)
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: '100%', border: '1px solid #d1d5db', padding: '6px 8px', marginBottom: 8 }}
          />
          <button
            type="button"
            disabled={saving}
            className="admin-btn"
            onClick={() =>
              patch({
                action: 'mark_quoted',
                quotedAmount: amount ? Number(amount) : undefined,
                quotedNotes: notes || undefined,
              })
            }
          >
            {saving ? 'Saving…' : 'Confirm Quoted'}
          </button>
        </div>
      )}

      {(status === 'REQUESTED' || status === 'QUOTED') && (
        <button
          type="button"
          disabled={saving}
          onClick={() => patch({ action: 'cancel' })}
          style={{ border: '1px solid #b91c1c', color: '#b91c1c', background: '#fff', padding: '8px 16px', cursor: 'pointer' }}
        >
          Cancel
        </button>
      )}

      {error && <p style={{ color: '#b91c1c', fontSize: '0.8125rem' }}>{error}</p>}
    </div>
  )
}
