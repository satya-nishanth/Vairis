'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type PromoRow = {
  id: string
  code: string
  description: string
  kind: 'PERCENT' | 'FLAT'
  value: number
  minOrderValue: number
  maxDiscount: number | null
  startsAt: string | null
  endsAt: string | null
  maxRedemptions: number | null
  maxPerUser: number
  active: boolean
  redemptionCount: number
}

const EMPTY = {
  code: '',
  description: '',
  kind: 'PERCENT' as 'PERCENT' | 'FLAT',
  value: '',
  minOrderValue: '0',
  maxDiscount: '',
  maxRedemptions: '',
  maxPerUser: '1',
}

export function PromosManager({ initial }: { initial: PromoRow[] }) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function createPromo(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await fetch('/api/admin/promos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: form.code,
        description: form.description || undefined,
        kind: form.kind,
        value: form.value,
        minOrderValue: form.minOrderValue || 0,
        maxDiscount: form.maxDiscount || null,
        maxRedemptions: form.maxRedemptions || null,
        maxPerUser: form.maxPerUser || 1,
        active: true,
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Create failed')
      return
    }
    setForm(EMPTY)
    router.refresh()
  }

  async function toggleActive(p: PromoRow) {
    await fetch(`/api/admin/promos/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !p.active }),
    })
    router.refresh()
  }

  async function remove(p: PromoRow) {
    await fetch(`/api/admin/promos/${p.id}`, { method: 'DELETE' })
    router.refresh()
  }

  const input = {
    padding: '8px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: '0.8125rem',
  } as const

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <form
        onSubmit={createPromo}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10,
          alignItems: 'end',
          background: '#fff',
          border: '1px solid #f3f4f6',
          borderRadius: 8,
          padding: 16,
        }}
        data-testid="promo-create"
      >
        <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
          Code*
          <input
            style={{ ...input, textTransform: 'uppercase' }}
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="WELCOME10"
            required
          />
        </label>
        <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
          Type
          <select
            style={input}
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as 'PERCENT' | 'FLAT' }))}
          >
            <option value="PERCENT">% off</option>
            <option value="FLAT">₹ off</option>
          </select>
        </label>
        <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
          Value*
          <input
            style={input}
            type="number"
            min="1"
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            placeholder={form.kind === 'PERCENT' ? '10' : '2000'}
            required
          />
        </label>
        <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
          Min order ₹
          <input
            style={input}
            type="number"
            min="0"
            value={form.minOrderValue}
            onChange={(e) => setForm((f) => ({ ...f, minOrderValue: e.target.value }))}
          />
        </label>
        <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
          Max discount ₹
          <input
            style={input}
            type="number"
            min="0"
            value={form.maxDiscount}
            onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
            placeholder="cap (% only)"
          />
        </label>
        <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
          Total uses
          <input
            style={input}
            type="number"
            min="1"
            value={form.maxRedemptions}
            onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
            placeholder="∞"
          />
        </label>
        <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
          Per user
          <input
            style={input}
            type="number"
            min="1"
            value={form.maxPerUser}
            onChange={(e) => setForm((f) => ({ ...f, maxPerUser: e.target.value }))}
          />
        </label>
        <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4, gridColumn: '1 / -1' }}>
          Description
          <input
            style={input}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="e.g. Launch offer — 10% off"
          />
        </label>
        <button type="submit" className="admin-btn" disabled={busy} style={{ gridColumn: '1 / -1' }}>
          {busy ? 'Creating…' : '+ Create Promo'}
        </button>
        {error && <p style={{ color: '#dc2626', fontSize: '0.8125rem', gridColumn: '1 / -1' }}>{error}</p>}
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#6b7280' }}>
              <th style={{ padding: '8px 10px' }}>Code</th>
              <th style={{ padding: '8px 10px' }}>Discount</th>
              <th style={{ padding: '8px 10px' }}>Min Order</th>
              <th style={{ padding: '8px 10px' }}>Used</th>
              <th style={{ padding: '8px 10px' }}>Status</th>
              <th style={{ padding: '8px 10px' }} />
            </tr>
          </thead>
          <tbody>
            {initial.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }} data-testid="promo-row">
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                  {p.code}
                  {p.description && (
                    <span style={{ display: 'block', fontWeight: 400, color: '#9ca3af' }}>
                      {p.description}
                    </span>
                  )}
                </td>
                <td style={{ padding: '8px 10px' }}>
                  {p.kind === 'PERCENT' ? `${p.value}%` : `₹${p.value.toLocaleString('en-IN')}`}
                  {p.maxDiscount != null ? ` (max ₹${p.maxDiscount.toLocaleString('en-IN')})` : ''}
                </td>
                <td style={{ padding: '8px 10px' }}>₹{p.minOrderValue.toLocaleString('en-IN')}</td>
                <td style={{ padding: '8px 10px' }}>
                  {p.redemptionCount}
                  {p.maxRedemptions != null ? ` / ${p.maxRedemptions}` : ''}
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <span
                    className={
                      p.active ? 'admin-products__badge is-active' : 'admin-products__badge'
                    }
                  >
                    {p.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleActive(p)}
                    style={{ marginRight: 10, background: 'none', border: 'none', color: '#b8963e', cursor: 'pointer' }}
                  >
                    {p.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                  >
                    {p.redemptionCount > 0 ? 'Retire' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
            {initial.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                  No promo codes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
