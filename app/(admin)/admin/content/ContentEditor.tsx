'use client'

import { useRef, useState } from 'react'

type BannerForm = {
  title: string
  subtitle: string
  imageUrl: string
  linkUrl: string
  ctaLabel: string
  active: boolean
}

const EMPTY: BannerForm = {
  title: '',
  subtitle: '',
  imageUrl: '',
  linkUrl: '',
  ctaLabel: '',
  active: true,
}

/**
 * One collapsible editor per banner slot. Image uploads reuse the product
 * image pipeline (/api/admin/upload → Supabase storage).
 */
export function ContentEditor({
  slot,
  description,
  initial,
}: {
  slot: string
  description: string
  initial: BannerForm | null
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<BannerForm>(initial ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (field: keyof BannerForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  async function uploadImage(file: File) {
    setUploading(true)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        setMessage(json.error ?? 'Upload failed')
        return
      }
      setForm((f) => ({ ...f, imageUrl: json.url }))
    } finally {
      setUploading(false)
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/content/${slot}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      setMessage(res.ok ? 'Saved — live within a minute.' : (json.error ?? 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  const input: React.CSSProperties = {
    width: '100%',
    border: '1px solid #d1d5db',
    padding: '8px 10px',
    fontSize: '0.8125rem',
    marginBottom: 10,
  }
  const label: React.CSSProperties = {
    display: 'block',
    fontSize: '0.6875rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: 4,
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', marginBottom: 12 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span>
          <strong style={{ fontSize: '0.875rem', color: '#111827' }}>{slot}</strong>
          <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 10 }}>{description}</span>
        </span>
        <span style={{ fontSize: '0.75rem', color: initial?.active === false ? '#9ca3af' : '#15803d' }}>
          {initial === null ? 'using defaults' : initial.active ? 'customized' : 'disabled'} {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <form onSubmit={save} style={{ padding: '4px 20px 20px' }}>
          <label style={label}>Title</label>
          <input style={input} value={form.title} onChange={set('title')} placeholder="Leave empty to use the built-in text" />

          <label style={label}>Subtitle</label>
          <input style={input} value={form.subtitle} onChange={set('subtitle')} />

          <label style={label}>CTA label</label>
          <input style={input} value={form.ctaLabel} onChange={set('ctaLabel')} placeholder="e.g. Shop Now" />

          <label style={label}>Link URL</label>
          <input style={input} value={form.linkUrl} onChange={set('linkUrl')} placeholder="/all-products/rings" />

          <label style={label}>Image</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            {form.imageUrl && (
               
              <img src={form.imageUrl} alt="" style={{ width: 80, height: 50, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ padding: '6px 12px', fontSize: '0.75rem', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}
            >
              {uploading ? 'Uploading…' : form.imageUrl ? 'Replace image' : 'Upload image'}
            </button>
            {form.imageUrl && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                style={{ padding: '6px 12px', fontSize: '0.75rem', border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer' }}
              >
                Remove
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadImage(f)
                e.target.value = ''
              }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Active (uncheck to fall back to the built-in design without losing this content)
          </label>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '8px 20px',
              fontSize: '0.75rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: '#032b24',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {message && <span style={{ marginLeft: 12, fontSize: '0.8125rem', color: '#374151' }}>{message}</span>}
        </form>
      )}
    </div>
  )
}
