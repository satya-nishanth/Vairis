'use client'

import { useEffect, useRef, useState } from 'react'

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

const serif = 'Georgia, "Times New Roman", serif'

/**
 * One collapsible editor per banner slot with live storefront-style preview
 * and upload preview (local file + saved URL).
 */
export function ContentEditor({
  slot,
  description,
  initial,
  label,
  defaultIntro,
}: {
  slot: string
  description: string
  initial: BannerForm | null
  label?: string
  /** Fallback intro for category preview when ctaLabel empty */
  defaultIntro?: string
}) {
  const isCategoryHero = slot.startsWith('plp-hero-')
  const isHomeHero = slot === 'home-hero'
  const heading = label ?? slot

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<BannerForm>(initial ?? EMPTY)
  const [savedImageUrl, setSavedImageUrl] = useState(initial?.imageUrl ?? '')
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageOk, setMessageOk] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  const displayImage = localPreview || form.imageUrl
  const hasUnsavedImage = Boolean(localPreview) || form.imageUrl !== savedImageUrl

  const set =
    (field: keyof BannerForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  function clearLocalPreview() {
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  async function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) {
      setMessage('Please choose an image file')
      setMessageOk(false)
      return
    }
    clearLocalPreview()
    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setUploading(true)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        setMessage(json.error ?? 'Upload failed')
        setMessageOk(false)
        clearLocalPreview()
        return
      }
      setForm((f) => ({ ...f, imageUrl: json.url as string }))
      clearLocalPreview()
      setMessage('Image uploaded - click Save to publish')
      setMessageOk(true)
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
      if (res.ok) {
        setSavedImageUrl(form.imageUrl)
        setMessage('Saved - live on the storefront shortly.')
        setMessageOk(true)
      } else {
        setMessage(json.error ?? 'Save failed')
        setMessageOk(false)
      }
    } finally {
      setSaving(false)
    }
  }

  function removeImage() {
    clearLocalPreview()
    setForm((f) => ({ ...f, imageUrl: '' }))
  }

  const statusLabel =
    !form.active
      ? 'Off'
      : !initial && !form.imageUrl && !form.title
        ? 'Defaults'
        : hasUnsavedImage
          ? 'Unsaved image'
          : 'Live'

  const statusColor =
    statusLabel === 'Live'
      ? '#15803d'
      : statusLabel === 'Unsaved image'
        ? '#b45309'
        : statusLabel === 'Off'
          ? '#9ca3af'
          : '#6b7280'

  const fieldLabel: React.CSSProperties = {
    display: 'block',
    fontSize: '0.6875rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: 6,
  }
  const field: React.CSSProperties = {
    width: '100%',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: '10px 12px',
    fontSize: '0.875rem',
    color: '#111827',
    background: '#fff',
    marginBottom: 14,
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        marginBottom: 14,
        overflow: 'hidden',
        boxShadow: open ? '0 8px 24px rgba(0,0,0,0.06)' : 'none',
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 18px',
          background: open ? '#fafafa' : '#fff',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: 72,
            height: 48,
            borderRadius: 6,
            overflow: 'hidden',
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {displayImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.06em' }}>NO IMG</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <strong style={{ fontSize: '0.9375rem', color: '#111827', fontWeight: 600 }}>{heading}</strong>
            <span
              style={{
                fontSize: '0.625rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: 999,
                background: `${statusColor}18`,
                color: statusColor,
                fontWeight: 600,
              }}
            >
              {statusLabel}
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {description}
          </p>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{open ? 'Collapse' : 'Edit'}</span>
      </button>

      {open && (
        <form onSubmit={save} style={{ padding: '0 18px 20px', borderTop: '1px solid #f3f4f6' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 1.1fr)',
              gap: 20,
              paddingTop: 18,
            }}
            className="content-editor-grid"
          >
            {/* Fields */}
            <div>
              <label style={fieldLabel}>Hero image</label>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  void handleFile(e.dataTransfer.files?.[0])
                }}
                onClick={() => !uploading && fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#032b24' : '#d1d5db'}`,
                  borderRadius: 10,
                  background: dragOver ? '#f0fdf4' : '#fafafa',
                  padding: 16,
                  marginBottom: 10,
                  cursor: uploading ? 'wait' : 'pointer',
                  textAlign: 'center',
                  transition: 'border-color 120ms, background 120ms',
                }}
              >
                {displayImage ? (
                  <div style={{ position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayImage}
                      alt="Upload preview"
                      style={{
                        width: '100%',
                        maxHeight: 200,
                        objectFit: 'cover',
                        borderRadius: 8,
                        display: 'block',
                      }}
                    />
                    {uploading && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(255,255,255,0.72)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: '#032b24',
                        }}
                      >
                        Uploading…
                      </div>
                    )}
                    {localPreview && !uploading && (
                      <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#b45309' }}>
                        Local preview - finishing upload…
                      </p>
                    )}
                    {form.imageUrl && !localPreview && (
                      <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                        Click or drop to replace
                      </p>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '28px 8px' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#111827', fontWeight: 500 }}>
                      {uploading ? 'Uploading…' : 'Drop image here or click to upload'}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                      JPG / PNG / WebP - large landscape works best
                    </p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    void handleFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </div>

              {displayImage && (
                <button
                  type="button"
                  onClick={removeImage}
                  style={{
                    marginBottom: 16,
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    color: '#b91c1c',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Remove image
                </button>
              )}

              {isCategoryHero ? (
                <>
                  <label style={fieldLabel}>Headline line 1</label>
                  <textarea
                    style={{ ...field, minHeight: 64, resize: 'vertical', fontFamily: serif, fontSize: '1rem' }}
                    value={form.title}
                    onChange={set('title')}
                    placeholder="She bought it after her first solo presentation."
                  />
                  <label style={fieldLabel}>Headline line 2</label>
                  <textarea
                    style={{ ...field, minHeight: 64, resize: 'vertical', fontFamily: serif, fontSize: '1rem' }}
                    value={form.subtitle}
                    onChange={set('subtitle')}
                    placeholder="Still wears it on every big day since."
                  />
                  <label style={fieldLabel}>Intro (under headline)</label>
                  <textarea
                    style={{ ...field, minHeight: 56, resize: 'vertical' }}
                    value={form.ctaLabel}
                    onChange={set('ctaLabel')}
                    placeholder={defaultIntro ?? 'Minimal diamonds designed for everyday confidence.'}
                  />
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '-6px 0 14px' }}>
                    Empty headline keeps rotating built-in stories. Empty intro uses the category default.
                  </p>
                </>
              ) : (
                <>
                  <label style={fieldLabel}>Title</label>
                  <input style={field} value={form.title} onChange={set('title')} placeholder="Diamonds You'll Actually Wear." />
                  <label style={fieldLabel}>Subtitle</label>
                  <textarea
                    style={{ ...field, minHeight: 56, resize: 'vertical' }}
                    value={form.subtitle}
                    onChange={set('subtitle')}
                    placeholder="Minimal diamond jewellery designed for everyday confidence."
                  />
                  {(isHomeHero || slot === 'promo-bar') && (
                    <>
                      <label style={fieldLabel}>{isHomeHero ? 'CTA label' : 'Link label / text'}</label>
                      <input style={field} value={form.ctaLabel} onChange={set('ctaLabel')} placeholder="Shop Now" />
                      <label style={fieldLabel}>Link URL</label>
                      <input style={field} value={form.linkUrl} onChange={set('linkUrl')} placeholder="/all-products/necklaces" />
                    </>
                  )}
                </>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', marginBottom: 16, color: '#374151' }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Active - show this customization on the site
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  style={{
                    padding: '10px 22px',
                    fontSize: '0.75rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    background: '#032b24',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: saving || uploading ? 'wait' : 'pointer',
                    opacity: saving || uploading ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                {message && (
                  <span style={{ fontSize: '0.8125rem', color: messageOk ? '#15803d' : '#b91c1c' }}>{message}</span>
                )}
              </div>
            </div>

            {/* Live preview */}
            <div>
              <div style={{ ...fieldLabel, marginBottom: 8 }}>Live preview</div>
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: '#fff',
                  minHeight: 220,
                }}
              >
                <div
                  style={{
                    fontSize: '0.625rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#9ca3af',
                    padding: '8px 12px',
                    borderBottom: '1px solid #f3f4f6',
                    background: '#fafafa',
                  }}
                >
                  {isCategoryHero ? `${heading} category page` : isHomeHero ? 'Home hero' : heading}
                  {!form.active ? ' (inactive - shop uses defaults)' : ''}
                </div>

                {isCategoryHero ? (
                  <CategoryPreview
                    title={heading}
                    line1={form.title}
                    line2={form.subtitle}
                    intro={form.ctaLabel || defaultIntro || ''}
                    imageUrl={displayImage}
                    active={form.active}
                  />
                ) : isHomeHero ? (
                  <HomePreview
                    title={form.title || "Diamonds You'll Actually Wear."}
                    subtitle={
                      form.subtitle ||
                      'Minimal diamond jewellery designed for work, coffee runs, date nights and everyday confidence.'
                    }
                    cta={form.ctaLabel || 'Shop Now'}
                    imageUrl={displayImage}
                    active={form.active}
                  />
                ) : (
                  <SimplePreview
                    title={form.title || 'Promo text'}
                    subtitle={form.subtitle}
                    imageUrl={displayImage}
                    active={form.active}
                  />
                )}
              </div>
              <p style={{ fontSize: '0.6875rem', color: '#9ca3af', margin: '8px 0 0' }}>
                Preview updates as you type / upload. Save to publish.
              </p>
            </div>
          </div>

          <style>{`
            @media (max-width: 860px) {
              .content-editor-grid {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>
        </form>
      )}
    </div>
  )
}

function CategoryPreview({
  title,
  line1,
  line2,
  intro,
  imageUrl,
  active,
}: {
  title: string
  line1: string
  line2: string
  intro: string
  imageUrl: string
  active: boolean
}) {
  const showDefaults = !active || (!line1 && !line2)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.1fr 1.2fr',
        minHeight: 200,
        opacity: active ? 1 : 0.55,
      }}
    >
      <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
        <p style={{ margin: 0, fontSize: '0.625rem', color: '#9ca3af' }}>Home / {title}</p>
        {showDefaults ? (
          <p style={{ margin: 0, fontFamily: serif, fontSize: '1.05rem', lineHeight: 1.45, color: '#9ca3af', fontStyle: 'italic' }}>
            Rotating built-in story will show here
          </p>
        ) : (
          <>
            {line1 && (
              <p style={{ margin: 0, fontFamily: serif, fontSize: '1.05rem', lineHeight: 1.4, color: '#111827' }}>{line1}</p>
            )}
            {line2 && (
              <p style={{ margin: 0, fontFamily: serif, fontSize: '1.05rem', lineHeight: 1.4, color: '#111827' }}>{line2}</p>
            )}
          </>
        )}
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.45 }}>
          {intro || 'Category intro text…'}
        </p>
      </div>
      <div style={{ background: '#f3f4f6', minHeight: 200, position: 'relative' }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>
            Hero image preview
          </div>
        )}
      </div>
    </div>
  )
}

function HomePreview({
  title,
  subtitle,
  cta,
  imageUrl,
  active,
}: {
  title: string
  subtitle: string
  cta: string
  imageUrl: string
  active: boolean
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        minHeight: 200,
        opacity: active ? 1 : 0.55,
      }}
    >
      <div style={{ padding: '18px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
        <p style={{ margin: 0, fontSize: '0.625rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af' }}>
          Everyday Diamond Wear
        </p>
        <p style={{ margin: 0, fontFamily: serif, fontSize: '1.25rem', lineHeight: 1.25, color: '#111827' }}>{title}</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.45 }}>{subtitle}</p>
        <span
          style={{
            alignSelf: 'flex-start',
            background: '#032b24',
            color: '#fff',
            fontSize: '0.625rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '8px 14px',
            borderRadius: 4,
          }}
        >
          {cta}
        </span>
      </div>
      <div style={{ background: '#f3f4f6', position: 'relative', minHeight: 200 }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>
            Hero image preview
          </div>
        )}
      </div>
    </div>
  )
}

function SimplePreview({
  title,
  subtitle,
  imageUrl,
  active,
}: {
  title: string
  subtitle: string
  imageUrl: string
  active: boolean
}) {
  return (
    <div style={{ padding: 16, opacity: active ? 1 : 0.55 }}>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6, marginBottom: 10 }} />
      )}
      <p style={{ margin: 0, fontWeight: 600, color: '#111827' }}>{title}</p>
      {subtitle && <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>{subtitle}</p>}
    </div>
  )
}
