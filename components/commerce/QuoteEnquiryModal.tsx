// components/commerce/QuoteEnquiryModal.tsx
'use client'

import { useEffect, useState } from 'react'
import { WHATSAPP_URL } from '@/lib/ui-data'

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

  // Prefill from saved addresses
  useEffect(() => {
    if (!open || !isLoggedIn) return
    let ignore = false
    fetch('/api/account/addresses')
      .then((res) => (res.ok ? res.json() : []))
      .then((addresses: { contactName: string; contactPhone: string }[]) => {
        if (ignore) return
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
    return () => {
      ignore = true
    }
  }, [open, isLoggedIn])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

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
      window.open(`${WHATSAPP_URL}?text=${text}`, '_blank', 'noopener,noreferrer')
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
        style={{
          background: 'var(--bg-card, #fff)',
          border: '1px solid var(--color-border-light, #e5e7eb)',
          padding: '1.5rem',
          maxWidth: 360,
          width: '90%',
          borderRadius: 8,
          boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.15))',
        }}
      >
        <h2 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: 12, color: 'var(--color-text, #111)' }}>Enquire on WhatsApp</h2>
        <label htmlFor="quote-name" style={{ display: 'block', fontSize: '0.75rem', marginBottom: 4, color: 'var(--color-text, #374151)' }}>Name</label>
        <input
          id="quote-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{
            width: '100%',
            border: '1px solid var(--color-border, #d1d5db)',
            background: 'var(--bg-page, #fff)',
            color: 'var(--color-text, #111)',
            padding: '8px 10px',
            marginBottom: 10,
            borderRadius: 4,
          }}
        />
        <label htmlFor="quote-mobile" style={{ display: 'block', fontSize: '0.75rem', marginBottom: 4, color: 'var(--color-text, #374151)' }}>Mobile (India)</label>
        <input
          id="quote-mobile"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={10}
          value={mobile}
          onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
          required
          placeholder="9876543210"
          style={{
            width: '100%',
            border: '1px solid var(--color-border, #d1d5db)',
            background: 'var(--bg-page, #fff)',
            color: 'var(--color-text, #111)',
            padding: '8px 10px',
            marginBottom: 10,
            borderRadius: 4,
          }}
        />
        <label htmlFor="quote-note" style={{ display: 'block', fontSize: '0.75rem', marginBottom: 4, color: 'var(--color-text, #374151)' }}>Note (optional)</label>
        <input
          id="quote-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{
            width: '100%',
            border: '1px solid var(--color-border, #d1d5db)',
            background: 'var(--bg-page, #fff)',
            color: 'var(--color-text, #111)',
            padding: '8px 10px',
            marginBottom: 12,
            borderRadius: 4,
          }}
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
