'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type MarkPaidOfflineProps = {
  orderId: string
  amount: number
}

/** Offline settlement: PAYMENT_PENDING → PAYMENT_CONFIRMED with required URN/txn ID. */
export function MarkPaidOffline({ orderId, amount }: MarkPaidOfflineProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [urn, setUrn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const txnId = urn.trim()
    if (!txnId) {
      setError('Enter the URN / transaction ID')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PAYMENT_CONFIRMED',
          note: `URN/Txn: ${txnId}`,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not mark paid')
        return
      }
      setOpen(false)
      setUrn('')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: 14 }}>
        <button type="button" className="admin-btn" onClick={() => setOpen(true)}>
          Mark paid offline
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      style={{
        marginTop: 14,
        padding: 14,
        border: '1px solid #d1d5db',
        background: '#fafbfa',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 420,
      }}
    >
      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#374151' }}>
        Record offline payment of{' '}
        <strong>₹{amount.toLocaleString('en-IN')}</strong> (UPI / bank transfer).
      </p>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: '#6b7280' }}>
        URN / transaction ID
        <input
          type="text"
          required
          autoComplete="off"
          value={urn}
          onChange={(e) => setUrn(e.target.value)}
          placeholder="e.g. 402398765432 or NEFT ref"
          style={{
            border: '1px solid #d1d5db',
            padding: '8px 10px',
            fontSize: '0.875rem',
            color: '#111827',
            background: '#fff',
          }}
        />
      </label>
      {error && (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#b91c1c' }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="admin-btn" disabled={busy}>
          {busy ? 'Saving…' : 'Confirm paid'}
        </button>
        <button
          type="button"
          className="admin-btn"
          disabled={busy}
          onClick={() => {
            setOpen(false)
            setUrn('')
            setError(null)
          }}
          style={{ background: '#fff', color: '#032b24', border: '1px solid #032b24' }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
