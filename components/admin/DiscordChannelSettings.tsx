'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  padding: '8px 10px',
  fontSize: '0.8125rem',
  fontFamily: 'ui-monospace, monospace',
}
const label: React.CSSProperties = {
  display: 'block',
  fontSize: '0.6875rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#6b7280',
  margin: '0 0 4px',
}

export function DiscordChannelSettings({
  initial,
}: {
  initial: {
    threadChannelId: string | null
    pingChannelId: string | null
    envThreadChannelId: string | null
  }
}) {
  const router = useRouter()
  const [threadChannelId, setThreadChannelId] = useState(initial.threadChannelId ?? '')
  const [pingChannelId, setPingChannelId] = useState(initial.pingChannelId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/admin/quotations/discord-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadChannelId: threadChannelId.trim() || '',
          pingChannelId: pingChannelId.trim() || '',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Save failed')
        return
      }
      setThreadChannelId(data.threadChannelId ?? '')
      setPingChannelId(data.pingChannelId ?? '')
      setSaved(true)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '1.25rem', marginBottom: '1.5rem' }}>
      <strong style={{ fontSize: '0.875rem' }}>Discord channels</strong>
      <p style={{ fontSize: '0.8125rem', color: '#4b5563', margin: '8px 0 14px' }}>
        Enable Developer Mode in Discord → right-click a channel → Copy Channel ID. Leave thread
        channel blank to use the env default
        {initial.envThreadChannelId ? (
          <>
            {' '}
            (<code>{initial.envThreadChannelId}</code>)
          </>
        ) : null}
        . Ping channel is optional — when set, every desk update/@mention also posts there.
      </p>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <div>
          <label style={label}>Thread channel (threads created here)</label>
          <input
            style={input}
            value={threadChannelId}
            onChange={(e) => setThreadChannelId(e.target.value)}
            placeholder={initial.envThreadChannelId || 'Channel snowflake'}
          />
        </div>
        <div>
          <label style={label}>Ping channel (updates &amp; @mentions)</label>
          <input
            style={input}
            value={pingChannelId}
            onChange={(e) => setPingChannelId(e.target.value)}
            placeholder="Optional — channel snowflake"
          />
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', fontSize: '0.8125rem', marginTop: 10 }}>{error}</p>}
      {saved && !error && (
        <p style={{ color: '#065f46', fontSize: '0.8125rem', marginTop: 10 }}>Saved.</p>
      )}

      <button
        type="button"
        className="admin-btn"
        style={{ marginTop: 14 }}
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? 'Saving…' : 'Save channels'}
      </button>
    </div>
  )
}
