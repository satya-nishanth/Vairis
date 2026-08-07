'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type OrderNote = {
  id: string
  author: string
  body: string
  internal: boolean
  createdAt: string | Date
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  padding: '1.25rem',
  marginBottom: '1rem',
  gridColumn: '1 / -1',
}
const heading: React.CSSProperties = {
  fontSize: '0.75rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#6b7280',
  marginBottom: 12,
}

/**
 * Admin notes panel — internal (WhatsApp context, negotiation, etc.) by
 * default; toggling a note to customer-visible surfaces it verbatim on the
 * order page and track-order (OrderTimeline "Updates"/event-log merge).
 * Mounted per-order-id, so a split child's panel only ever touches that
 * child's own notes (lib/split.ts keeps notes on the order they belong to).
 */
export function OrderNotes({ orderId, notes }: { orderId: string; notes: OrderNote[] }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const btn: React.CSSProperties = {
    padding: '6px 14px',
    fontSize: '0.75rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    border: '1px solid #032b24',
    background: '#032b24',
    color: '#fff',
    cursor: 'pointer',
  }
  const btnGhost: React.CSSProperties = {
    fontSize: '0.75rem',
    background: 'none',
    border: '1px solid #d1d5db',
    padding: '2px 8px',
    cursor: 'pointer',
    color: '#032b24',
  }

  async function handleAdd() {
    setError(null)
    if (body.trim().length === 0) {
      setError('Note body required.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, internal }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not add note.')
        return
      }
      setBody('')
      setInternal(true)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggle(noteId: string, nextInternal: boolean) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internal: nextInternal }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not update visibility.')
        return
      }
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={card}>
      <h3 style={heading}>Notes</h3>

      {notes.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: 12 }}>No notes yet.</p>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {notes.map((n) => (
            <div
              key={n.id}
              style={{ padding: '8px 0', borderTop: '1px solid #f3f4f6', fontSize: '0.875rem' }}
            >
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: 4 }}>
                {n.author} ·{' '}
                {new Date(n.createdAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}{' '}
                ·{' '}
                <span style={{ color: n.internal ? '#b45309' : '#15803d' }}>
                  {n.internal ? 'Internal' : 'Customer-visible'}
                </span>
              </p>
              <p style={{ marginBottom: 6 }}>{n.body}</p>
              <button
                type="button"
                onClick={() => handleToggle(n.id, !n.internal)}
                disabled={busy}
                style={btnGhost}
              >
                Mark {n.internal ? 'customer-visible' : 'internal'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
          rows={3}
          style={{ width: '100%', fontSize: '0.875rem', padding: 8, border: '1px solid #d1d5db', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
            />
            Internal (not shown to customer)
          </label>
          <button type="button" onClick={handleAdd} disabled={busy} style={btn}>
            {busy ? 'Adding…' : 'Add Note'}
          </button>
        </div>
        {error && (
          <p style={{ color: '#b91c1c', fontSize: '0.8125rem', marginTop: 8 }}>{error}</p>
        )}
      </div>
    </div>
  )
}
