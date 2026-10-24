'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Product = { id: string; name: string; itemCode: string | null }

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

export function QuotationForm({ products }: { products: Product[] }) {
  const router = useRouter()
  const [orderType, setOrderType] = useState<'VAIRIS' | 'CUSTOMISATION' | ''>('')
  const [details, setDetails] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerMobile, setCustomerMobile] = useState('')
  const [productId, setProductId] = useState('')
  const [screenshots, setScreenshots] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function uploadScreenshots(): Promise<string[]> {
    const urls: string[] = []
    for (const file of screenshots) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'quotations/screenshots')
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Screenshot upload failed')
      urls.push(data.url)
    }
    return urls
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!orderType) {
      setError('Select an order type')
      return
    }
    if (!details.trim()) {
      setError('Details are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const screenshotUrls = await uploadScreenshots()
      const res = await fetch('/api/admin/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType,
          details,
          customerName: customerName || undefined,
          customerMobile: customerMobile || undefined,
          productId: productId || undefined,
          screenshotUrls,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not create quotation')
        return
      }
      router.push(`/admin/quotations/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={card}>
        <strong style={{ fontSize: '0.875rem' }}>Order type</strong>
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
            <input
              type="radio"
              name="orderType"
              required
              checked={orderType === 'VAIRIS'}
              onChange={() => setOrderType('VAIRIS')}
            />
            Vairis
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
            <input
              type="radio"
              name="orderType"
              required
              checked={orderType === 'CUSTOMISATION'}
              onChange={() => setOrderType('CUSTOMISATION')}
            />
            Customisation
          </label>
        </div>
      </div>

      <div style={card}>
        <strong style={{ fontSize: '0.875rem' }}>Details</strong>
        <label style={label}>What does the customer want? (required)</label>
        <textarea
          style={{ ...input, minHeight: 100 }}
          required
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="e.g. Kurnool bracelet quotation — customer wants 22K gold, ~15g, plain design"
        />

        <label style={label}>Screenshots (optional)</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setScreenshots(Array.from(e.target.files ?? []))}
        />

        <label style={label}>Customer name (optional)</label>
        <input style={input} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />

        <label style={label}>Mobile (optional)</label>
        <input style={input} value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="9876543210" />

        <label style={label}>Product reference (optional)</label>
        <select style={input} value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">— None —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.itemCode ? ` (${p.itemCode})` : ''}
            </option>
          ))}
        </select>
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
        {saving ? 'Creating…' : 'Create Quotation'}
      </button>
    </form>
  )
}
