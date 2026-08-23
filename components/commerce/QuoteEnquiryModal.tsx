// components/commerce/QuoteEnquiryModal.tsx
'use client'

import { useEffect, useState } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  isLoggedIn: boolean
  productName: string
  productUrl: string
  itemCode: string | null
}

export function QuoteEnquiryModal({ open, onClose, isLoggedIn, productName, productUrl, itemCode }: Props) {
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !isLoggedIn) return
    fetch('/api/account/addresses')
      .then((res) => (res.ok ? res.json() : []))
      .then((addresses: { contactName: string; contactPhone: string }[]) => {
        const first = addresses[0]
        if (first) {
          setName((n) => n || first.contactName)
          setMobile((m) => m || first.contactPhone)
        }
      })
      .catch(() => {
        // Prefill is a convenience only — an unauthenticated 401 or network error
        // just leaves the fields blank for manual entry.
      })
  }, [open, isLoggedIn])

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !/^\d{7,15}$/.test(mobile.trim())) {
      setError('Enter your name and a valid mobile number')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: name.trim(), customerMobile: mobile.trim(), details: note || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not submit your enquiry — try again')
        return
      }
      const text = encodeURIComponent(
        `Hi! I'm interested in *${productName}*${itemCode ? ` (Code: ${itemCode})` : ''} from VAIRIS.\n${productUrl}\n\nRef ${data.displayId}`,
      )
      window.open(`https://wa.me/917075486464?text=${text}`, '_blank', 'noopener,noreferrer')
      onClose()
    } catch {
      setError('Network error — check your connection and try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', padding: '1.5rem', maxWidth: 360, width: '90%', borderRadius: 4 }}
      >
        <h2 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: 12 }}>Enquire on WhatsApp</h2>
        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: 4 }}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ width: '100%', border: '1px solid #d1d5db', padding: '8px 10px', marginBottom: 10 }}
        />
        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: 4 }}>Mobile</label>
        <input
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          required
          placeholder="9876543210"
          style={{ width: '100%', border: '1px solid #d1d5db', padding: '8px 10px', marginBottom: 10 }}
        />
        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: 4 }}>Note (optional)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ width: '100%', border: '1px solid #d1d5db', padding: '8px 10px', marginBottom: 12 }}
        />
        {error && <p style={{ color: '#b91c1c', fontSize: '0.75rem', marginBottom: 10 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1 }}>
            {submitting ? 'Sending…' : 'Continue to WhatsApp'}
          </button>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
