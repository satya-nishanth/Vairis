'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toDateInput } from '@/lib/finance'

type AccountOpt = { id: string; name: string }

type Expense = {
  id: string
  date: string
  description: string
  amount: number
  paidThrough: 'VAIRIS_BANK' | 'PERSONAL_FUNDS'
  accountId: string | null
  accountName: string | null
}

const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  padding: '8px 10px',
  fontSize: '0.8125rem',
}

export function ExpenseManager({
  initial,
  accounts,
  defaultAccountId,
}: {
  initial: Expense[]
  accounts: AccountOpt[]
  defaultAccountId: string | null
}) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [date, setDate] = useState(() => toDateInput(new Date()))
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidThrough, setPaidThrough] = useState<'VAIRIS_BANK' | 'PERSONAL_FUNDS'>('VAIRIS_BANK')
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const editing = useMemo(() => rows.find((r) => r.id === editingId) ?? null, [rows, editingId])

  function load(row: Expense) {
    setEditingId(row.id)
    setDate(toDateInput(new Date(row.date)))
    setDescription(row.description)
    setAmount(String(row.amount))
    setPaidThrough(row.paidThrough)
    setAccountId(row.accountId ?? defaultAccountId ?? accounts[0]?.id ?? '')
  }

  function reset() {
    setEditingId(null)
    setDate(toDateInput(new Date()))
    setDescription('')
    setAmount('')
    setPaidThrough('VAIRIS_BANK')
    setAccountId(defaultAccountId ?? accounts[0]?.id ?? '')
    setError('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body = {
      date,
      description,
      amount: Number(amount),
      paidThrough,
      // Account = who is accountable; allowed with company bank ("I paid through company")
      accountId: accountId || null,
    }
    try {
      const res = await fetch(
        editingId ? `/api/admin/finance/expenses/${editingId}` : '/api/admin/finance/expenses',
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
        return [json, ...rs]
      })
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this expense?')) return
    const res = await fetch(`/api/admin/finance/expenses/${id}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) return
    setRows((rs) => rs.filter((r) => r.id !== id))
    if (editingId === id) reset()
    router.refresh()
  }

  return (
    <div>
      <form onSubmit={save} style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 16, marginBottom: 20 }}>
        <strong style={{ fontSize: '0.875rem' }}>{editing ? 'Edit expense' : 'New expense'}</strong>
        {error && <p style={{ color: '#b91c1c', fontSize: '0.8125rem' }}>{error}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <label>
            Date
            <input style={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            Amount (₹)
            <input style={input} type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </label>
        </div>
        <label style={{ display: 'block', marginTop: 12 }}>
          Description
          <input style={input} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </label>
        <label style={{ display: 'block', marginTop: 12 }}>
          Account (who is accountable)
          <select style={input} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">— None —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'block', marginTop: 12 }}>
          Paid through (which wallet moved)
          <select style={input} value={paidThrough} onChange={(e) => setPaidThrough(e.target.value as typeof paidThrough)}>
            <option value="VAIRIS_BANK">Company bank</option>
            <option value="PERSONAL_FUNDS">Personal funds</option>
          </select>
        </label>
        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '8px 0 0' }}>
          Example: Account = you, Paid through = company bank → you arranged it, company paid.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="submit" className="admin-btn" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add expense'}
          </button>
          {editing && (
            <button type="button" className="admin-btn" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <table className="admin-products" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 10 }}>Date</th>
            <th style={{ textAlign: 'left', padding: 10 }}>Description</th>
            <th style={{ textAlign: 'right', padding: 10 }}>Amount</th>
            <th style={{ textAlign: 'left', padding: 10 }}>Account</th>
            <th style={{ textAlign: 'left', padding: 10 }}>Through</th>
            <th style={{ padding: 10 }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 16, color: '#6b7280' }}>
                No expenses yet.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10 }}>{toDateInput(new Date(r.date))}</td>
              <td style={{ padding: 10 }}>{r.description}</td>
              <td style={{ padding: 10, textAlign: 'right' }}>₹{r.amount.toLocaleString('en-IN')}</td>
              <td style={{ padding: 10 }}>{r.accountName ?? '—'}</td>
              <td style={{ padding: 10 }}>{r.paidThrough === 'PERSONAL_FUNDS' ? 'Personal' : 'Company'}</td>
              <td style={{ padding: 10, whiteSpace: 'nowrap' }}>
                <button type="button" className="admin-btn" onClick={() => load(r)} style={{ marginRight: 8 }}>
                  Edit
                </button>
                <button type="button" className="admin-btn" onClick={() => void remove(r.id)} style={{ color: '#b91c1c' }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
