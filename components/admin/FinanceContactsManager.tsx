'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FinanceContactType } from '@prisma/client'
import { FinanceCollapsible } from '@/components/admin/FinanceCollapsible'

export type ContactRow = {
  id: string
  name: string
  type: FinanceContactType
  email: string | null
  phone: string | null
  notes: string | null
  active: boolean
}

const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  padding: '8px 10px',
  fontSize: '0.8125rem',
}

const TYPES: FinanceContactType[] = ['CUSTOMER', 'VENDOR', 'OTHER']

export function FinanceContactsManager({ initial }: { initial: ContactRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<FinanceContactType>('VENDOR')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function load(row: ContactRow) {
    setEditingId(row.id)
    setName(row.name)
    setType(row.type)
    setEmail(row.email ?? '')
    setPhone(row.phone ?? '')
    setNotes(row.notes ?? '')
    setError('')
  }

  function reset() {
    setEditingId(null)
    setName('')
    setType('VENDOR')
    setEmail('')
    setPhone('')
    setNotes('')
    setError('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body = {
      name,
      type,
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
      active: true,
    }
    try {
      const res = await fetch(
        editingId ? `/api/admin/finance/contacts/${editingId}` : '/api/admin/finance/contacts',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Save failed')
        return
      }
      const id = editingId
      reset()
      router.refresh()
      setRows((rs) => {
        if (id) return rs.map((r) => (r.id === id ? json : r))
        return [...rs, json].sort((a, b) => a.name.localeCompare(b.name))
      })
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this contact?')) return
    const res = await fetch(`/api/admin/finance/contacts/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return
    setRows((rs) => rs.map((r) => (r.id === id ? json : r)))
    router.refresh()
  }

  return (
    <div>
      <FinanceCollapsible title={editingId ? 'Edit contact' : 'Add contact'} forceOpen={!!editingId}>
        <form onSubmit={save} style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
          <label style={{ fontSize: '0.75rem' }}>
            Name
            <input style={input} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label style={{ fontSize: '0.75rem' }}>
            Type
            <select style={input} value={type} onChange={(e) => setType(e.target.value as FinanceContactType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '0.75rem' }}>
            Email
            <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label style={{ fontSize: '0.75rem' }}>
            Phone
            <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label style={{ fontSize: '0.75rem' }}>
            Notes
            <textarea style={{ ...input, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {error && <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.8125rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="admin-btn" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Add contact'}
            </button>
            {editingId && (
              <button type="button" className="admin-btn" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </FinanceCollapsible>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', background: '#fff' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
            <th style={{ padding: 8 }}>Name</th>
            <th style={{ padding: 8 }}>Type</th>
            <th style={{ padding: 8 }}>Email</th>
            <th style={{ padding: 8 }}>Phone</th>
            <th style={{ padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: r.active ? 1 : 0.55 }}>
              <td style={{ padding: 8 }}>{r.name}</td>
              <td style={{ padding: 8 }}>{r.type}</td>
              <td style={{ padding: 8 }}>{r.email ?? '—'}</td>
              <td style={{ padding: 8 }}>{r.phone ?? '—'}</td>
              <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                <button type="button" className="admin-btn" onClick={() => load(r)}>
                  Edit
                </button>{' '}
                {r.active && (
                  <button type="button" className="admin-btn" onClick={() => deactivate(r.id)}>
                    Deactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 12, color: '#6b7280' }}>
                No contacts yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
