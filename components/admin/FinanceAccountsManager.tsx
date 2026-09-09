'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ACCOUNT_TYPE_LABEL } from '@/lib/finance'
import type { FinanceAccountType } from '@prisma/client'
import { FinanceCollapsible } from '@/components/admin/FinanceCollapsible'

export type AccountRow = {
  id: string
  name: string
  email: string | null
  type: FinanceAccountType
  active: boolean
  sortOrder: number
}

const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  padding: '8px 10px',
  fontSize: '0.8125rem',
}

const TYPES: FinanceAccountType[] = ['PARTNER', 'COMPANY_BANK', 'CASH', 'OTHER']

export function FinanceAccountsManager({ initial }: { initial: AccountRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [type, setType] = useState<FinanceAccountType>('PARTNER')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const editing = useMemo(() => rows.find((r) => r.id === editingId) ?? null, [rows, editingId])

  function load(row: AccountRow) {
    setEditingId(row.id)
    setName(row.name)
    setEmail(row.email ?? '')
    setType(row.type)
    setActive(row.active)
    setError('')
  }

  function reset() {
    setEditingId(null)
    setName('')
    setEmail('')
    setType('PARTNER')
    setActive(true)
    setError('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body = { name, email: email.trim() || null, type, active }
    try {
      const res = await fetch(
        editingId ? `/api/admin/finance/accounts/${editingId}` : '/api/admin/finance/accounts',
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
        return [...rs, json].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      })
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this account?')) return
    const res = await fetch(`/api/admin/finance/accounts/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return
    setRows((rs) => rs.map((r) => (r.id === id ? json : r)))
    router.refresh()
  }

  return (
    <div>
      <FinanceCollapsible title={editing ? 'Edit account' : 'Add account'} forceOpen={!!editingId}>
        <form onSubmit={save} style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
          <label style={{ fontSize: '0.75rem' }}>
            Name
            <input style={input} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label style={{ fontSize: '0.75rem' }}>
            Email (login match for default)
            <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label style={{ fontSize: '0.75rem' }}>
            Type
            <select style={input} value={type} onChange={(e) => setType(e.target.value as FinanceAccountType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '0.75rem', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
          {error && <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.8125rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="admin-btn" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Add account'}
            </button>
            {editing && (
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
            <th style={{ padding: 8 }}>Account</th>
            <th style={{ padding: 8 }}>Email</th>
            <th style={{ padding: 8 }}>Type</th>
            <th style={{ padding: 8 }}>Status</th>
            <th style={{ padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: r.active ? 1 : 0.55 }}>
              <td style={{ padding: 8 }}>{r.name}</td>
              <td style={{ padding: 8 }}>{r.email ?? '—'}</td>
              <td style={{ padding: 8 }}>{ACCOUNT_TYPE_LABEL[r.type]}</td>
              <td style={{ padding: 8 }}>{r.active ? 'Active' : 'Inactive'}</td>
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
        </tbody>
      </table>
    </div>
  )
}
