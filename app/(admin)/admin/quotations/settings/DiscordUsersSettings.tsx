'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Row = {
  id: string
  handle: string
  discordUserId: string
  email: string | null
  label: string | null
  active: boolean
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
  margin: '10px 0 4px',
}

export function DiscordUsersSettings({ initial }: { initial: Row[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [handle, setHandle] = useState('')
  const [discordUserId, setDiscordUserId] = useState('')
  const [email, setEmail] = useState('')
  const [displayLabel, setDisplayLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveNew() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/quotations/discord-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          discordUserId,
          email: email || null,
          label: displayLabel || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Save failed')
        return
      }
      setRows((prev) => [...prev, data].sort((a, b) => a.handle.localeCompare(b.handle)))
      setHandle('')
      setDiscordUserId('')
      setEmail('')
      setDisplayLabel('')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this Discord mapping?')) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/quotations/discord-users?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Delete failed')
        return
      }
      setRows((prev) => prev.filter((r) => r.id !== id))
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row: Row) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/quotations/discord-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          handle: row.handle,
          discordUserId: row.discordUserId,
          email: row.email,
          label: row.label,
          active: !row.active,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Update failed')
        return
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? data : r)))
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '1.25rem', marginBottom: '1rem' }}>
        <strong style={{ fontSize: '0.875rem' }}>How tagging works</strong>
        <p style={{ fontSize: '0.8125rem', color: '#4b5563', margin: '8px 0 0' }}>
          Add a handle (e.g. <code>anil</code>). In quote comments type <code>@anil</code> — the Discord
          thread ping becomes a real mention. Find a Discord user ID: enable Developer Mode → right-click
          the user → Copy User ID.
        </p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '1.25rem', marginBottom: '1rem' }}>
        <strong style={{ fontSize: '0.875rem' }}>Add mapping</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={label}>Handle (for @)</label>
            <input style={input} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="anil" />
          </div>
          <div>
            <label style={label}>Discord user ID</label>
            <input
              style={input}
              value={discordUserId}
              onChange={(e) => setDiscordUserId(e.target.value)}
              placeholder="123456789012345678"
            />
          </div>
          <div>
            <label style={label}>Email (optional)</label>
            <input
              style={input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="anil@…"
            />
          </div>
          <div>
            <label style={label}>Label (optional)</label>
            <input
              style={input}
              value={displayLabel}
              onChange={(e) => setDisplayLabel(e.target.value)}
              placeholder="Anil"
            />
          </div>
        </div>
        {error && <p style={{ color: '#b91c1c', fontSize: '0.8125rem', marginTop: 10 }}>{error}</p>}
        <button
          type="button"
          className="admin-btn"
          style={{ marginTop: 14 }}
          disabled={saving || !handle.trim() || !discordUserId.trim()}
          onClick={() => void saveNew()}
        >
          {saving ? 'Saving…' : 'Add user'}
        </button>
      </div>

      <div className="admin-table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
              <th style={{ padding: '10px 12px' }}>Handle</th>
              <th style={{ padding: '10px 12px' }}>Discord ID</th>
              <th style={{ padding: '10px 12px' }}>Email</th>
              <th style={{ padding: '10px 12px' }}>Label</th>
              <th style={{ padding: '10px 12px' }}>Active</th>
              <th style={{ padding: '10px 12px' }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '1.5rem 12px', color: '#9ca3af' }}>
                  No mappings yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: r.active ? 1 : 0.55 }}>
                  <td style={{ padding: '10px 12px' }}>@{r.handle}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {r.discordUserId}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{r.email || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{r.label || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void toggleActive(r)}
                      style={{
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      {r.active ? 'On' : 'Off'}
                    </button>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void remove(r.id)}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#b91c1c',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        textDecoration: 'underline',
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
