'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PERSON_LABEL, toDateInput } from '@/lib/finance'
import type { FinancePerson } from '@prisma/client'

type Expense = {
  id: string
  date: string
  description: string
  amount: number
  paidThrough: 'VAIRIS_BANK' | 'PERSONAL_FUNDS'
  contributor: FinancePerson | null
}

const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  padding: '8px 10px',
  fontSize: '0.8125rem',
}

export function ExpenseManager({
  initial,
  defaultPerson,
}: {
  initial: Expense[]
  defaultPerson: FinancePerson
}) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [date, setDate] = useState(() => toDateInput(new Date()))
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidThrough, setPaidThrough] = useState<'VAIRIS_BANK' | 'PERSONAL_FUNDS'>('VAIRIS_BANK')
  const [contributor, setContributor] = useState<FinancePerson>(defaultPerson)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const editing = useMemo(() => rows.find((r) => r.id === editingId) ?? null, [rows, editingId])

  function load(row: Expense) {
    setEditingId(row.id)
    setDate(toDateInput(new Date(row.date)))
    setDescription(row.description)
    setAmount(String(row.amount))
    setPaidThrough(row.paidThrough)
    setContributor(row.contributor ?? defaultPerson)
  }

  function reset() {
    setEditingId(null)
    setDate(toDateInput(new Date()))
    setDescription('')
    setAmount('')
    setPaidThrough('VAIRIS_BANK')
    setContributor(defaultPerson)
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
      contributor: paidThrough === 'PERSONAL_FUNDS' ? contributor : null,
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
          Paid through
          <select style={input} value={paidThrough} onChange={(e) => setPaidThrough(e.target.value as typeof paidThrough)}>
            <option value="VAIRIS_BANK">Vairis bank</option>
            <option value="PERSONAL_FUNDS">Personal funds</option>
          </select>
        </label>
        {paidThrough === 'PERSONAL_FUNDS' && (
          <label style={{ display: 'block', marginTop: 12 }}>
            Contributor
            <select style={input} value={contributor} onChange={(e) => setContributor(e.target.value as FinancePerson)}>
              {(['ANIL', 'SURYA', 'VASU'] as const).map((p) => (
                <option key={p} value={p}>
                  {PERSON_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
        )}
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
            <th style={{ textAlign: 'left', padding: 10 }}>Paid through</th>
            <th style={{ padding: 10 }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 16, color: '#6b7280' }}>
                No expenses yet.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10 }}>{toDateInput(new Date(r.date))}</td>
              <td style={{ padding: 10 }}>{r.description}</td>
              <td style={{ padding: 10, textAlign: 'right' }}>₹{r.amount.toLocaleString('en-IN')}</td>
              <td style={{ padding: 10 }}>
                {r.paidThrough === 'PERSONAL_FUNDS'
                  ? `Personal · ${r.contributor ? PERSON_LABEL[r.contributor] : '—'}`
                  : 'Vairis bank'}
              </td>
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
