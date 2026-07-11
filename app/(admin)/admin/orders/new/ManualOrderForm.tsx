'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DEPOSIT_RATE } from '@/lib/orders'

type VariantOption = { variantId: string; label: string; suggestedPrice: number }
type Customer = { id: string; email: string; name: string; mobile: string | null }
type Line = { variantId: string; quantity: number; unitPrice: number }

const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  padding: '8px 10px',
  fontSize: '0.8125rem',
}
const label: React.CSSProperties = {
  display: 'block',
  fontSize: '0.6875rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#6b7280',
  margin: '12px 0 4px',
}
const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  padding: '1.25rem',
  marginBottom: '1rem',
}

export function ManualOrderForm({ variantOptions }: { variantOptions: VariantOption[] }) {
  const router = useRouter()

  // Customer search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)

  // Address / contact
  const [address, setAddress] = useState({
    contactName: '',
    contactPhone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
  })

  // Lines + settlement
  const [lines, setLines] = useState<Line[]>([])
  const [applyDeposit, setApplyDeposit] = useState(false)
  const [paid, setPaid] = useState(true)
  const [paymentNote, setPaymentNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search(q: string) {
    setQuery(q)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`)
    if (res.ok) setResults(await res.json())
  }

  function pickCustomer(c: Customer) {
    setCustomer(c)
    setResults([])
    setQuery(c.email)
    setAddress((a) => ({
      ...a,
      contactName: a.contactName || c.name,
      contactPhone: a.contactPhone || (c.mobile ?? ''),
    }))
  }

  function addLine(variantId: string) {
    const opt = variantOptions.find((v) => v.variantId === variantId)
    if (!opt) return
    setLines((ls) => [...ls, { variantId, quantity: 1, unitPrice: opt.suggestedPrice }])
  }

  const total = Math.round(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0))
  const grandTotal = applyDeposit ? Math.round(total * (1 + DEPOSIT_RATE)) : total
  const deposit = grandTotal - total
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) {
      setError('Select a customer first')
      return
    }
    if (lines.length === 0) {
      setError('Add at least one item')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: customer.id,
          ...address,
          applyDeposit,
          initialStatus: paid ? 'PAYMENT_CONFIRMED' : 'PENDING',
          paymentNote: paymentNote || undefined,
          items: lines,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not create order')
        return
      }
      router.push(`/admin/orders/${data.orderId}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={card}>
        <strong style={{ fontSize: '0.875rem' }}>1 · Customer</strong>
        <label style={label}>Search by email or name</label>
        <input
          style={input}
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="customer@email.com"
        />
        {results.length > 0 && (
          <div style={{ border: '1px solid #e5e7eb', borderTop: 'none' }}>
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCustomer(c)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  fontSize: '0.8125rem',
                  background: '#fff',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                }}
              >
                {c.name} — {c.email}
              </button>
            ))}
          </div>
        )}
        {customer && (
          <p style={{ marginTop: 8, fontSize: '0.8125rem', color: '#15803d' }}>
            ✓ {customer.name} ({customer.email})
          </p>
        )}
      </div>

      <div style={card}>
        <strong style={{ fontSize: '0.875rem' }}>2 · Items</strong>
        <label style={label}>Add product variant</label>
        <select style={input} value="" onChange={(e) => e.target.value && addLine(e.target.value)}>
          <option value="">— pick a variant —</option>
          {variantOptions.map((v) => (
            <option key={v.variantId} value={v.variantId}>
              {v.label} · {inr(v.suggestedPrice)}
            </option>
          ))}
        </select>

        {lines.map((line, idx) => {
          const opt = variantOptions.find((v) => v.variantId === line.variantId)!
          return (
            <div
              key={idx}
              style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: '0.8125rem' }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {opt.label}
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={line.quantity}
                onChange={(e) =>
                  setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity: Number(e.target.value) } : l)))
                }
                style={{ ...input, width: 64 }}
                aria-label="Quantity"
              />
              <input
                type="number"
                min={1}
                value={line.unitPrice}
                onChange={(e) =>
                  setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, unitPrice: Number(e.target.value) } : l)))
                }
                style={{ ...input, width: 130 }}
                aria-label="Unit price (₹)"
              />
              <button
                type="button"
                onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                style={{ border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer' }}
                aria-label="Remove line"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <div style={card}>
        <strong style={{ fontSize: '0.875rem' }}>3 · Delivery</strong>
        <label style={label}>Contact name</label>
        <input style={input} required value={address.contactName} onChange={(e) => setAddress((a) => ({ ...a, contactName: e.target.value }))} />
        <label style={label}>Mobile (10 digits)</label>
        <input style={input} required pattern="\d{10}" value={address.contactPhone} onChange={(e) => setAddress((a) => ({ ...a, contactPhone: e.target.value }))} />
        <label style={label}>Address line 1</label>
        <input style={input} required value={address.addressLine1} onChange={(e) => setAddress((a) => ({ ...a, addressLine1: e.target.value }))} />
        <label style={label}>Address line 2 (optional)</label>
        <input style={input} value={address.addressLine2} onChange={(e) => setAddress((a) => ({ ...a, addressLine2: e.target.value }))} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <label style={label}>City</label>
            <input style={input} required value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} />
          </div>
          <div>
            <label style={label}>State</label>
            <input style={input} required value={address.state} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))} />
          </div>
          <div>
            <label style={label}>Pincode</label>
            <input style={input} required pattern="\d{6}" value={address.pincode} onChange={(e) => setAddress((a) => ({ ...a, pincode: e.target.value }))} />
          </div>
        </div>
      </div>

      <div style={card}>
        <strong style={{ fontSize: '0.875rem' }}>4 · Settlement</strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', margin: '12px 0 0' }}>
          <input type="checkbox" checked={applyDeposit} onChange={(e) => setApplyDeposit(e.target.checked)} />
          Apply 5% refundable security deposit (customer pays 105%, deposit returned after delivery)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', margin: '10px 0 0' }}>
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          Payment already received (UPI / bank transfer)
        </label>
        <label style={label}>Payment reference note (shown on the order timeline)</label>
        <input style={input} value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="e.g. GPay ref 402398765432" />

        <div style={{ marginTop: 16, fontSize: '0.875rem', borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
          <p>Goods total: {inr(total)}</p>
          {applyDeposit && <p>Security deposit (5%): {inr(deposit)}</p>}
          <p style={{ fontWeight: 600 }}>Customer pays: {inr(grandTotal)}</p>
        </div>
      </div>

      {error && (
        <p style={{ fontSize: '0.8125rem', color: '#b91c1c', background: '#fef2f2', padding: '8px 12px', border: '1px solid #fecaca', marginBottom: 12 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '10px 28px',
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          background: '#032b24',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {saving ? 'Creating…' : 'Create Order'}
      </button>
    </form>
  )
}
