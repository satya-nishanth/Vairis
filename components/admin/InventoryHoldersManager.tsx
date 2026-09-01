'use client'

import { useState } from 'react'
import { InventorySubnav } from '@/components/admin/InventorySubnav'

type Holder = { id: string; name: string; active: boolean; sortOrder: number; itemCount: number }

async function readApiJson(res: Response): Promise<{ data?: unknown; error?: string }> {
  const text = await res.text()
  if (!text.trim()) {
    return { error: res.ok ? 'Empty response from server' : `Request failed (${res.status})` }
  }
  try {
    return { data: JSON.parse(text) as unknown }
  } catch {
    return { error: `Invalid server response (${res.status})` }
  }
}

export function InventoryHoldersManager({ initial }: { initial: Holder[] }) {
  const [holders, setHolders] = useState(initial)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [rowError, setRowError] = useState<string | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await fetch('/api/admin/inventory/holders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const { data, error: parseError } = await readApiJson(res)
    if (parseError) {
      setError(parseError)
      return
    }
    const body = data as { error?: string; id?: string; name?: string; active?: boolean; sortOrder?: number }
    if (!res.ok) {
      setError(body.error ?? 'Could not add')
      return
    }
    setHolders((h) =>
      [...h, { ...(body as Holder), itemCount: 0 }].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    )
    setName('')
  }

  async function toggleActive(id: string, active: boolean) {
    setRowError(null)
    const res = await fetch(`/api/admin/inventory/holders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    const { data, error: parseError } = await readApiJson(res)
    if (parseError) {
      setRowError(parseError)
      return
    }
    const body = data as { error?: string; active?: boolean }
    if (!res.ok) {
      setRowError(body.error ?? 'Could not update')
      return
    }
    setHolders((h) => h.map((row) => (row.id === id ? { ...row, active: body.active! } : row)))
  }

  function startEdit(h: Holder) {
    setRowError(null)
    setEditingId(h.id)
    setEditName(h.name)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setRowError(null)
  }

  async function saveEdit(id: string) {
    const trimmed = editName.trim()
    if (!trimmed) {
      setRowError('Name is required')
      return
    }
    setRowError(null)
    const res = await fetch(`/api/admin/inventory/holders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    const { data, error: parseError } = await readApiJson(res)
    if (parseError) {
      setRowError(parseError)
      return
    }
    const body = data as { error?: string; name?: string }
    if (!res.ok) {
      setRowError(body.error ?? 'Could not save')
      return
    }
    setHolders((h) =>
      h
        .map((row) => (row.id === id ? { ...row, name: body.name! } : row))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    )
    cancelEdit()
  }

  async function remove(h: Holder) {
    if (h.itemCount > 0) {
      setRowError(`“${h.name}” has ${h.itemCount} inventory line(s) — reassign them before deleting.`)
      return
    }
    if (!confirm(`Delete holder “${h.name}”?`)) return
    setRowError(null)
    const res = await fetch(`/api/admin/inventory/holders/${h.id}`, { method: 'DELETE' })
    const { data, error: parseError } = await readApiJson(res)
    if (parseError) {
      setRowError(parseError)
      return
    }
    const body = data as { error?: string }
    if (!res.ok) {
      setRowError(body.error ?? 'Could not delete')
      return
    }
    setHolders((list) => list.filter((row) => row.id !== h.id))
    if (editingId === h.id) cancelEdit()
  }

  return (
    <>
      <InventorySubnav />

      <form onSubmit={add} className="inv-card" style={{ maxWidth: 480 }}>
        <div className="inv-field">
          <label>New holder name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Karigar — Ramesh" required />
        </div>
        {error && <p style={{ color: '#b91c1c', fontSize: '0.8125rem' }}>{error}</p>}
        <button type="submit" className="admin-btn">
          Add holder
        </button>
      </form>

      {rowError && (
        <p style={{ color: '#b91c1c', fontSize: '0.8125rem', marginBottom: 12 }}>{rowError}</p>
      )}

      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Stock lines</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {holders.map((h) => (
              <tr key={h.id}>
                <td>
                  {editingId === h.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        fontSize: '0.8125rem',
                      }}
                    />
                  ) : (
                    h.name
                  )}
                </td>
                <td>{h.active ? 'Active' : 'Inactive'}</td>
                <td style={{ color: h.itemCount > 0 ? '#374151' : '#9ca3af' }}>{h.itemCount}</td>
                <td>
                  <div className="inv-holder-actions">
                    {editingId === h.id ? (
                      <>
                        <button type="button" className="admin-btn" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => saveEdit(h.id)}>
                          Save
                        </button>
                        <button type="button" className="admin-btn admin-btn--secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={cancelEdit}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="admin-btn admin-btn--secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => startEdit(h)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--danger"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => remove(h)}
                          disabled={h.itemCount > 0}
                          title={h.itemCount > 0 ? 'Reassign inventory lines before deleting' : undefined}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => toggleActive(h.id, !h.active)}
                        >
                          {h.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
