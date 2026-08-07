'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SectionRow = {
  id: string
  kind: string
  title: string
  subtitle: string
  config: string // JSON text
  active: boolean
  sortOrder: number
  startsAt: string
  endsAt: string
}

const KIND_HELP: Record<string, string> = {
  'collection-rail': '{ "collectionSlug": "bridal-edit", "limit": 8 }',
  editorial: '{ "image": "https://…", "ctaLabel": "Explore", "ctaHref": "/collections/…" }',
  video: '{ "url": "https://…/video.mp4", "poster": "https://…" }',
  usp: '{ "items": [{ "icon": "💎", "title": "IGI Certified", "description": "…" }] }',
}

const input = {
  padding: '8px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  fontSize: '0.8125rem',
  width: '100%',
} as const

export function SectionsManager({
  sections,
  collections,
}: {
  sections: SectionRow[]
  collections: { slug: string; title: string }[]
}) {
  const router = useRouter()
  const [kind, setKind] = useState('collection-rail')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [collectionSlug, setCollectionSlug] = useState(collections[0]?.slug ?? '')
  const [configText, setConfigText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    let config: Record<string, unknown> = {}
    if (kind === 'collection-rail') {
      config = { collectionSlug, limit: 8 }
    } else if (configText.trim()) {
      try {
        config = JSON.parse(configText)
      } catch {
        setError('Config is not valid JSON')
        setBusy(false)
        return
      }
    }
    const res = await fetch('/api/admin/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, title: title || null, subtitle: subtitle || null, config }),
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Create failed')
      return
    }
    setTitle('')
    setSubtitle('')
    setConfigText('')
    router.refresh()
  }

  async function patch(id: string, data: Record<string, unknown>) {
    await fetch(`/api/admin/sections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    router.refresh()
  }

  async function remove(id: string) {
    await fetch(`/api/admin/sections/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  function move(idx: number, dir: -1 | 1) {
    const other = sections[idx + dir]
    const cur = sections[idx]
    if (!other) return
    patch(cur.id, { sortOrder: other.sortOrder })
    patch(other.id, { sortOrder: cur.sortOrder })
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <form
        onSubmit={create}
        style={{ display: 'grid', gap: 10, background: '#fff', border: '1px solid #f3f4f6', borderRadius: 8, padding: 16 }}
        data-testid="section-create"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
            Section type
            <select style={input} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="collection-rail">Collection rail (product carousel)</option>
              <option value="editorial">Editorial banner (image + copy + CTA)</option>
              <option value="video">Video block</option>
              <option value="usp">USP strip (icons + text)</option>
            </select>
          </label>
          {kind === 'collection-rail' ? (
            <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
              Collection
              <select style={input} value={collectionSlug} onChange={(e) => setCollectionSlug(e.target.value)}>
                {collections.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.title}
                  </option>
                ))}
              </select>
              {collections.length === 0 && (
                <span style={{ color: '#dc2626' }}>Create a collection first.</span>
              )}
            </label>
          ) : (
            <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
              Config (JSON) — e.g. {KIND_HELP[kind]}
              <textarea
                style={{ ...input, fontFamily: 'monospace' }}
                rows={2}
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                placeholder={KIND_HELP[kind]}
              />
            </label>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
            Title (optional)
            <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
            Subtitle (optional)
            <input style={input} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </label>
        </div>
        {error && <p style={{ color: '#dc2626', fontSize: '0.8125rem' }}>{error}</p>}
        <button type="submit" className="admin-btn" disabled={busy || (kind === 'collection-rail' && !collectionSlug)} style={{ justifySelf: 'start' }}>
          {busy ? 'Adding…' : '+ Add Section'}
        </button>
      </form>

      <div style={{ display: 'grid', gap: 8 }}>
        {sections.map((s, i) => (
          <div
            key={s.id}
            style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #f3f4f6', borderRadius: 8, padding: '10px 14px' }}
            data-testid="section-row"
          >
            <div style={{ display: 'grid', gap: 2 }}>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}>▲</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label="Move down" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}>▼</button>
            </div>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: '0.875rem' }}>
                {s.title || s.kind}
                <span className="admin-products__badge" style={{ marginLeft: 8 }}>{s.kind}</span>
                <span className={s.active ? 'admin-products__badge is-active' : 'admin-products__badge'} style={{ marginLeft: 6 }}>
                  {s.active ? 'Active' : 'Off'}
                </span>
              </strong>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '2px 0 0', fontFamily: 'monospace' }}>
                {s.config.length > 90 ? `${s.config.slice(0, 90)}…` : s.config}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, whiteSpace: 'nowrap' }}>
              <button
                type="button"
                onClick={() => patch(s.id, { active: !s.active })}
                style={{ background: 'none', border: 'none', color: '#b8963e', cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                {s.active ? 'Disable' : 'Enable'}
              </button>
              <button
                type="button"
                onClick={() => remove(s.id)}
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {sections.length === 0 && (
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            No sections yet — the home page shows its built-in layout.
          </p>
        )}
      </div>
    </div>
  )
}
