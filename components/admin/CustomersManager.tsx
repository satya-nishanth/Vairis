'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

export type CustomerRow = {
  id: string
  name: string
  email: string
  mobile: string | null
  createdAt: string
  orderCount: number
}

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
  marginBottom: 4,
}

export function CustomersManager({ initial }: { initial: CustomerRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.mobile ?? '').includes(q),
    )
  }, [rows, query])

  function load(row: CustomerRow) {
    setEditingId(row.id)
    setName(row.name)
    setEmail(row.email)
    setMobile(row.mobile ?? '')
    setError('')
  }

  function reset() {
    setEditingId(null)
    setName('')
    setEmail('')
    setMobile('')
    setError('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body = {
      name: name.trim(),
      email: email.trim(),
      mobile: mobile.trim() || null,
    }
    try {
      const res = await fetch(editingId ? `/api/admin/users/${editingId}` : '/api/admin/users', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Save failed')
        return
      }

      if (editingId) {
        setRows((rs) => rs.map((r) => (r.id === editingId ? { ...r, ...json } : r)))
        reset()
        router.refresh()
        return
      }

      // POST returns { id, email, name, mobile } — enrich for the list
      const created: CustomerRow = {
        id: json.id,
        name: json.name,
        email: json.email,
        mobile: json.mobile ?? null,
        createdAt: new Date().toISOString(),
        orderCount: 0,
      }
      setRows((rs) => [created, ...rs].sort((a, b) => a.name.localeCompare(b.name)))
      reset()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          padding: '1.25rem',
          marginBottom: '1rem',
        }}
      >
        <strong style={{ fontSize: '0.875rem' }}>
          {editingId ? 'Edit customer' : 'Add customer'}
        </strong>
        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '6px 0 12px' }}>
          Same records used when creating manual orders. Email must be unique — they can sign in
          later with this address.
        </p>
        <form onSubmit={save} style={{ display: 'grid', gap: 10, maxWidth: 480 }}>
          <div>
            <label style={label}>Name</label>
            <input style={input} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label style={label}>Email</label>
            <input
              style={input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={label}>Mobile (10 digits)</label>
            <input
              style={input}
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              pattern="\d{10}"
              placeholder="Optional"
            />
          </div>
          {error && (
            <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.8125rem' }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="admin-btn" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Add customer'}
            </button>
            {editingId && (
              <button type="button" className="admin-btn" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={{ marginBottom: 12, maxWidth: 360 }}>
        <label style={label}>Search</label>
        <input
          style={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, email, or mobile…"
        />
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: 10 }}>Name</th>
              <th style={{ padding: 10 }}>Email</th>
              <th style={{ padding: 10 }}>Mobile</th>
              <th style={{ padding: 10 }}>Orders</th>
              <th style={{ padding: 10 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 10 }}>{r.name}</td>
                <td style={{ padding: 10 }}>{r.email}</td>
                <td style={{ padding: 10 }}>{r.mobile ?? '—'}</td>
                <td style={{ padding: 10 }}>{r.orderCount}</td>
                <td style={{ padding: 10, whiteSpace: 'nowrap' }}>
                  <button type="button" className="admin-btn" onClick={() => load(r)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 16, color: '#6b7280' }}>
                  {rows.length === 0 ? 'No customers yet.' : 'No matches.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
