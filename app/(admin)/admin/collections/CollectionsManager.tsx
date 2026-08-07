'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type CollectionRow = {
  id: string
  slug: string
  title: string
  subtitle: string
  description: string
  heroImages: string[]
  active: boolean
  showInNav: boolean
  productIds: string[]
}

type ProductOption = { id: string; label: string }

const EMPTY: Omit<CollectionRow, 'id'> = {
  slug: '',
  title: '',
  subtitle: '',
  description: '',
  heroImages: [],
  active: true,
  showInNav: false,
  productIds: [],
}

const input = {
  padding: '8px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  fontSize: '0.8125rem',
  width: '100%',
} as const

function CollectionForm({
  initial,
  allProducts,
  onSave,
  onCancel,
  busy,
  error,
}: {
  initial: Omit<CollectionRow, 'id'>
  allProducts: ProductOption[]
  onSave: (data: Omit<CollectionRow, 'id'>) => void
  onCancel?: () => void
  busy: boolean
  error: string
}) {
  const [form, setForm] = useState(initial)
  const [productSearch, setProductSearch] = useState('')

  const filtered = allProducts.filter(
    (p) =>
      !form.productIds.includes(p.id) &&
      p.label.toLowerCase().includes(productSearch.toLowerCase()),
  )

  return (
    <div style={{ display: 'grid', gap: 10, background: '#fff', border: '1px solid #f3f4f6', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
          Title*
          <input
            style={input}
            value={form.title}
            onChange={(e) => {
              const title = e.target.value
              setForm((f) => ({
                ...f,
                title,
                slug:
                  f.slug === '' || f.slug === slugify(f.title)
                    ? slugify(title)
                    : f.slug,
              }))
            }}
            placeholder="Bridal Edit"
          />
        </label>
        <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
          Slug* (/collections/…)
          <input
            style={input}
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder="bridal-edit"
          />
        </label>
      </div>
      <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
        Subtitle
        <input
          style={input}
          value={form.subtitle}
          onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
          placeholder="Pieces for the big day and every day after"
        />
      </label>
      <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
        Description (shown on the landing page)
        <textarea
          style={{ ...input, resize: 'vertical' }}
          rows={2}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </label>

      <div style={{ display: 'flex', gap: 16 }}>
        <label style={{ fontSize: '0.8125rem', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          Active
        </label>
        <label style={{ fontSize: '0.8125rem', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={form.showInNav}
            onChange={(e) => setForm((f) => ({ ...f, showInNav: e.target.checked }))}
          />
          Show in nav
        </label>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
          Products ({form.productIds.length})
        </span>
        {form.productIds.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
            {form.productIds.map((id, i) => {
              const p = allProducts.find((x) => x.id === id)
              return (
                <li key={id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#9ca3af' }}>{i + 1}.</span>
                  <span style={{ flex: 1 }}>{p?.label ?? id}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, productIds: f.productIds.filter((x) => x !== id) }))
                    }
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                    aria-label="Remove product"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <input
          style={input}
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          placeholder="Search products to add…"
        />
        {productSearch && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 160, overflowY: 'auto', border: '1px solid #f3f4f6', borderRadius: 6 }}>
            {filtered.slice(0, 12).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setForm((f) => ({ ...f, productIds: [...f.productIds, p.id] }))
                    setProductSearch('')
                  }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem' }}
                >
                  + {p.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li style={{ padding: '6px 10px', fontSize: '0.8125rem', color: '#9ca3af' }}>No matches</li>
            )}
          </ul>
        )}
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: '0.8125rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="admin-btn" disabled={busy} onClick={() => onSave(form)}>
          {busy ? 'Saving…' : 'Save Collection'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '0.8125rem' }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function CollectionsManager({
  collections,
  allProducts,
}: {
  collections: CollectionRow[]
  allProducts: ProductOption[]
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(data: Omit<CollectionRow, 'id'>, id?: string) {
    setBusy(true)
    setError('')
    const res = await fetch(id ? `/api/admin/collections/${id}` : '/api/admin/collections', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Save failed')
      return
    }
    setCreating(false)
    setEditingId(null)
    router.refresh()
  }

  async function remove(id: string) {
    await fetch(`/api/admin/collections/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {!creating && (
        <button type="button" className="admin-btn" onClick={() => setCreating(true)} style={{ justifySelf: 'start' }}>
          + New Collection
        </button>
      )}
      {creating && (
        <CollectionForm
          initial={EMPTY}
          allProducts={allProducts}
          onSave={(d) => save(d)}
          onCancel={() => setCreating(false)}
          busy={busy}
          error={error}
        />
      )}

      {collections.map((c) =>
        editingId === c.id ? (
          <CollectionForm
            key={c.id}
            initial={c}
            allProducts={allProducts}
            onSave={(d) => save(d, c.id)}
            onCancel={() => setEditingId(null)}
            busy={busy}
            error={error}
          />
        ) : (
          <div
            key={c.id}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', background: '#fff', border: '1px solid #f3f4f6', borderRadius: 8, padding: '12px 16px' }}
            data-testid="collection-row"
          >
            <div>
              <strong style={{ fontSize: '0.875rem' }}>
                {c.title}
                <span className={c.active ? 'admin-products__badge is-active' : 'admin-products__badge'} style={{ marginLeft: 8 }}>
                  {c.active ? 'Active' : 'Hidden'}
                </span>
                {c.showInNav && (
                  <span className="admin-products__badge is-ai" style={{ marginLeft: 6 }}>
                    In Nav
                  </span>
                )}
              </strong>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '2px 0 0' }}>
                /collections/{c.slug} · {c.productIds.length} products
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, whiteSpace: 'nowrap' }}>
              <a href={`/collections/${c.slug}`} target="_blank" style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                View
              </a>
              <button
                type="button"
                onClick={() => setEditingId(c.id)}
                style={{ background: 'none', border: 'none', color: '#b8963e', cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove(c.id)}
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                Delete
              </button>
            </div>
          </div>
        ),
      )}
      {collections.length === 0 && !creating && (
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No collections yet.</p>
      )}
    </div>
  )
}
