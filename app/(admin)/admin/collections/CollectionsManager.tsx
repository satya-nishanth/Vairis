'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  COLLECTION_COLLAGE_MAX,
  CollectionCoverCollage,
} from '@/components/commerce/CollectionCoverCollage'

type CollectionRow = {
  id: string
  slug: string
  title: string
  subtitle: string
  description: string
  heroImages: string[]
  coverMode: 'CUSTOM' | 'COLLAGE'
  active: boolean
  showInNav: boolean
  productIds: string[]
}

type ProductOption = { id: string; label: string; frontImage: string | null }

const EMPTY: Omit<CollectionRow, 'id'> = {
  slug: '',
  title: '',
  subtitle: '',
  description: '',
  heroImages: [],
  coverMode: 'CUSTOM',
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

function CollectionHeroImages({
  images,
  onChange,
}: {
  images: string[]
  onChange: (images: string[]) => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!list.length) return
    setUploading(true)
    const uploaded: string[] = []
    try {
      for (const file of list) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('folder', 'collections')
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.url) {
          alert(json.error ?? `Upload failed (${res.status})`)
          break
        }
        uploaded.push(json.url as string)
      }
      if (uploaded.length) onChange([...images, ...uploaded])
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function addUrl() {
    const url = urlDraft.trim()
    if (!url) return
    onChange([...images, url])
    setUrlDraft('')
  }

  function removeAt(idx: number) {
    onChange(images.filter((_, i) => i !== idx))
  }

  function moveToFront(idx: number) {
    if (idx === 0) return
    const next = [...images]
    const [img] = next.splice(idx, 1)
    next.unshift(img)
    onChange(next)
  }

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= images.length) return
    const next = [...images]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onChange(next)
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div>
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Upload images</span>
        <p style={{ margin: '2px 0 0', fontSize: '0.6875rem', color: '#6b7280' }}>
          First image is the face on /collections. Extra images show on the collection page carousel.
        </p>
      </div>

      {images.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 8,
          }}
        >
          {images.map((src, i) => (
            <li
              key={`${src}-${i}`}
              style={{
                position: 'relative',
                border: i === 0 ? '2px solid #b8963e' : '1px solid #e5e7eb',
                borderRadius: 8,
                overflow: 'hidden',
                background: '#f9fafb',
              }}
            >
              <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
                <Image src={src} alt="" fill style={{ objectFit: 'cover' }} sizes="120px" unoptimized />
              </div>
              <div
                style={{
                  padding: '4px 6px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 4,
                  alignItems: 'center',
                  fontSize: '0.625rem',
                }}
              >
                <span style={{ fontWeight: 600, color: i === 0 ? '#b8963e' : '#6b7280' }}>
                  {i === 0 ? 'Cover' : `#${i + 1}`}
                </span>
                <span style={{ flex: 1 }} />
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => moveToFront(i)}
                    style={{ background: 'none', border: 'none', color: '#b8963e', cursor: 'pointer', padding: 0 }}
                  >
                    Set cover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, padding: 0 }}
                  aria-label="Move earlier"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === images.length - 1}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: i === images.length - 1 ? 'default' : 'pointer',
                    opacity: i === images.length - 1 ? 0.3 : 1,
                    padding: 0,
                  }}
                  aria-label="Move later"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0 }}
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files)
        }}
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          border: '1px dashed #d1d5db',
          borderRadius: 8,
          padding: '14px 12px',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#6b7280',
          cursor: uploading ? 'wait' : 'pointer',
          background: '#fafafa',
        }}
      >
        {uploading ? 'Uploading…' : 'Drop images here or click to upload'}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void uploadFiles(e.target.files)
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={input}
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          placeholder="Or paste image URL…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addUrl()
            }
          }}
        />
        <button
          type="button"
          onClick={addUrl}
          disabled={!urlDraft.trim()}
          style={{
            padding: '8px 12px',
            fontSize: '0.75rem',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: '#fff',
            cursor: urlDraft.trim() ? 'pointer' : 'default',
            opacity: urlDraft.trim() ? 1 : 0.5,
            whiteSpace: 'nowrap',
          }}
        >
          Add URL
        </button>
      </div>
    </div>
  )
}

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

  const collagePreview = form.productIds
    .map((id) => allProducts.find((p) => p.id === id)?.frontImage)
    .filter((src): src is string => Boolean(src))
    .slice(0, COLLECTION_COLLAGE_MAX)

  return (
    <div style={{ display: 'grid', gap: 10, background: '#fff', border: '1px solid #f3f4f6', borderRadius: 8, padding: 16 }}>
      <div className="admin-grid-2">
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

      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Cover</span>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.8125rem', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="radio"
              name="coverMode"
              checked={form.coverMode === 'CUSTOM'}
              onChange={() => setForm((f) => ({ ...f, coverMode: 'CUSTOM' }))}
            />
            Custom image
          </label>
          <label style={{ fontSize: '0.8125rem', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="radio"
              name="coverMode"
              checked={form.coverMode === 'COLLAGE'}
              onChange={() => setForm((f) => ({ ...f, coverMode: 'COLLAGE' }))}
            />
            Product collage
          </label>
        </div>
        {form.coverMode === 'CUSTOM' ? (
          <CollectionHeroImages
            images={form.heroImages}
            onChange={(heroImages) => setForm((f) => ({ ...f, heroImages }))}
          />
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
              Live collage from the first {COLLECTION_COLLAGE_MAX} products with a front image
              (collection order). Updates when products are added or removed.
            </p>
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 320,
                height: 180,
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid #e5e7eb',
                background: '#f3f4f6',
              }}
            >
              <CollectionCoverCollage images={collagePreview} alt={form.title || 'Collection'} />
            </div>
          </div>
        )}
      </div>

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
      const msg =
        res.status === 409
          ? (j.error ?? 'A collection with this slug already exists — pick a different slug.')
          : (j.error ?? `Save failed (${res.status})`)
      setError(msg)
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

      {collections.map((c) => {
        const listCollage = c.productIds
          .map((id) => allProducts.find((p) => p.id === id)?.frontImage)
          .filter((src): src is string => Boolean(src))
          .slice(0, COLLECTION_COLLAGE_MAX)
        const useCollage = c.coverMode === 'COLLAGE'
        const hasCover = useCollage ? listCollage.length > 0 : Boolean(c.heroImages[0])

        return editingId === c.id ? (
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
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
              <div
                style={{
                  position: 'relative',
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#f3f4f6',
                  flexShrink: 0,
                  border: '1px solid #e5e7eb',
                }}
              >
                {useCollage && hasCover ? (
                  <CollectionCoverCollage images={listCollage} alt={c.title} />
                ) : c.heroImages[0] ? (
                  <Image
                    src={c.heroImages[0]}
                    alt=""
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="56px"
                    unoptimized
                  />
                ) : (
                  <span
                    style={{
                      display: 'flex',
                      width: '100%',
                      height: '100%',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.5625rem',
                      color: '#9ca3af',
                      textAlign: 'center',
                      padding: 4,
                    }}
                  >
                    No cover
                  </span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
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
                  {useCollage
                    ? ' · collage cover'
                    : c.heroImages.length > 0
                      ? ` · ${c.heroImages.length} image${c.heroImages.length === 1 ? '' : 's'}`
                      : ''}
                </p>
              </div>
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
        )
      })}
      {collections.length === 0 && !creating && (
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No collections yet.</p>
      )}
    </div>
  )
}
