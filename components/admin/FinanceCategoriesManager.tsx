'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FinanceCollapsible } from '@/components/admin/FinanceCollapsible'

export type CategoryRow = {
  id: string
  name: string
  direction: 'INFLOW' | 'OUTFLOW'
  active: boolean
  sortOrder: number
}

const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  padding: '8px 10px',
  fontSize: '0.8125rem',
}

function CategoryTable({
  rows,
  onEdit,
  onDeactivate,
}: {
  rows: CategoryRow[]
  onEdit: (row: CategoryRow) => void
  onDeactivate: (id: string) => void
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', background: '#fff' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
          <th style={{ padding: 8 }}>Name</th>
          <th style={{ padding: 8 }}>Status</th>
          <th style={{ padding: 8 }} />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: r.active ? 1 : 0.5 }}>
            <td style={{ padding: 8 }}>{r.name}</td>
            <td style={{ padding: 8 }}>{r.active ? 'Active' : 'Inactive'}</td>
            <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
              <button type="button" className="admin-btn" onClick={() => onEdit(r)} style={{ marginRight: 8 }}>
                Edit
              </button>
              {r.active && (
                <button type="button" className="admin-btn" onClick={() => void onDeactivate(r.id)}>
                  Deactivate
                </button>
              )}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={3} style={{ padding: 16, color: '#6b7280' }}>
              No categories yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

export function FinanceCategoriesManager({ initial }: { initial: CategoryRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [direction, setDirection] = useState<'INFLOW' | 'OUTFLOW'>('OUTFLOW')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inflow = useMemo(
    () =>
      rows
        .filter((r) => r.direction === 'INFLOW')
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [rows],
  )
  const outflow = useMemo(
    () =>
      rows
        .filter((r) => r.direction === 'OUTFLOW')
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [rows],
  )

  function load(row: CategoryRow) {
    setEditingId(row.id)
    setName(row.name)
    setDirection(row.direction)
    setError('')
  }

  function reset() {
    setEditingId(null)
    setName('')
    setDirection('OUTFLOW')
    setError('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch(
        editingId ? `/api/admin/finance/categories/${editingId}` : '/api/admin/finance/categories',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, direction, active: true }),
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
        return [...rs, json]
      })
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this category?')) return
    const res = await fetch(`/api/admin/finance/categories/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return
    setRows((rs) => rs.map((r) => (r.id === id ? json : r)))
    router.refresh()
  }

  return (
    <div>
      <FinanceCollapsible title={editingId ? 'Edit category' : 'Add category'} forceOpen={!!editingId}>
        <form onSubmit={save} style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
          <label style={{ fontSize: '0.75rem' }}>
            Direction
            <select
              style={input}
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'INFLOW' | 'OUTFLOW')}
            >
              <option value="OUTFLOW">Outflow</option>
              <option value="INFLOW">Inflow</option>
            </select>
          </label>
          <label style={{ fontSize: '0.75rem' }}>
            Name
            <input style={input} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          {error && <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.8125rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="admin-btn" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Add category'}
            </button>
            {editingId && (
              <button type="button" className="admin-btn" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </FinanceCollapsible>

      <h3 style={{ fontSize: '0.875rem', margin: '20px 0 8px' }}>Outflow</h3>
      <CategoryTable rows={outflow} onEdit={load} onDeactivate={deactivate} />

      <h3 style={{ fontSize: '0.875rem', margin: '24px 0 8px' }}>Inflow</h3>
      <CategoryTable rows={inflow} onEdit={load} onDeactivate={deactivate} />
    </div>
  )
}
