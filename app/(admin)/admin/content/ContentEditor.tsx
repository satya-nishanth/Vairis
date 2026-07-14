'use client'

import { useEffect, useRef, useState } from 'react'

type BannerForm = {
  title: string
  subtitle: string
  images: string[]
  linkUrl: string
  ctaLabel: string
  active: boolean
}

const EMPTY: BannerForm = {
  title: '',
  subtitle: '',
  images: [],
  linkUrl: '',
  ctaLabel: '',
  active: true,
}

const serif = 'Georgia, "Times New Roman", serif'

/**
 * Collapsible banner editor: unlimited carousel uploads, live storefront preview.
 */
export function ContentEditor({
  slot,
  description,
  initial,
  label,
  defaultIntro,
  builtInImages,
  builtInLine1,
  builtInLine2,
}: {
  slot: string
  description: string
  initial: BannerForm | null
  label?: string
  defaultIntro?: string
  builtInImages?: string[]
  builtInLine1?: string
  builtInLine2?: string
}) {
  const isCategoryHero = slot.startsWith('plp-hero-')
  const isHomeHero = slot === 'home-hero'
  const heading = label ?? slot
  const builtIns = (builtInImages ?? []).filter(Boolean)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<BannerForm>(initial ?? EMPTY)
  const [savedImages, setSavedImages] = useState<string[]>(initial?.images ?? [])
  const [localPreviews, setLocalPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [messageOk, setMessageOk] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      localPreviews.forEach((u) => URL.revokeObjectURL(u))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const customImages = form.images
  const showingBuiltIn = customImages.length === 0 && builtIns.length > 0
  const displayImages = customImages.length > 0 ? customImages : builtIns
  const previewSlides = [...displayImages, ...localPreviews]
  const activeSlide = previewSlides[previewIndex % Math.max(previewSlides.length, 1)] ?? ''

  const imagesChanged =
    customImages.length !== savedImages.length ||
    customImages.some((u, i) => u !== savedImages[i])
  const hasCustomContent = Boolean(
    customImages.length || form.title.trim() || form.subtitle.trim() || (isCategoryHero ? form.ctaLabel.trim() : false),
  )

  const statusLabel = !form.active
    ? 'Off'
    : imagesChanged || localPreviews.length
      ? 'Unsaved'
      : hasCustomContent
        ? 'Custom'
        : 'Built-in'

  const statusColor =
    statusLabel === 'Custom'
      ? '#15803d'
      : statusLabel === 'Unsaved'
        ? '#b45309'
        : statusLabel === 'Off'
          ? '#9ca3af'
          : '#0369a1'

  const set =
    (field: keyof BannerForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) {
      setMessage('Please choose image files')
      setMessageOk(false)
      return
    }

    const objectUrls = files.map((f) => URL.createObjectURL(f))
    setLocalPreviews((prev) => [...prev, ...objectUrls])
    setPreviewIndex((displayImages.length || 0) + localPreviews.length)
    setUploading(true)
    setMessage(null)

    const uploaded: string[] = []
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) {
          setMessage(json.error ?? 'Upload failed')
          setMessageOk(false)
          break
        }
        uploaded.push(json.url as string)
      }
      if (uploaded.length) {
        setForm((f) => ({ ...f, images: [...f.images, ...uploaded] }))
        setMessage(
          uploaded.length === 1
            ? 'Image added - click Save to publish'
            : `${uploaded.length} images added - click Save to publish`,
        )
        setMessageOk(true)
      }
    } finally {
      objectUrls.forEach((u) => URL.revokeObjectURL(u))
      setLocalPreviews([])
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
        body: JSON.stringify({
          title: form.title,
          subtitle: form.subtitle,
          images: form.images,
          imageUrl: form.images[0] ?? '',
          linkUrl: form.linkUrl,
          ctaLabel: form.ctaLabel,
          active: form.active,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setSavedImages([...form.images])
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

  function removeAt(index: number) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }))
    setPreviewIndex(0)
  }

  function move(index: number, dir: -1 | 1) {
    setForm((f) => {
      const next = [...f.images]
      const j = index + dir
      if (j < 0 || j >= next.length) return f
      ;[next[index], next[j]] = [next[j], next[index]]
      return { ...f, images: next }
    })
  }

  function clearCustomImages() {
    setForm((f) => ({ ...f, images: [] }))
    setPreviewIndex(0)
  }

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
            position: 'relative',
          }}
        >
          {displayImages[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayImages[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.06em' }}>NO IMG</span>
          )}
          {displayImages.length > 1 && (
            <span
              style={{
                position: 'absolute',
                right: 3,
                bottom: 3,
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 4,
              }}
            >
              {displayImages.length}
            </span>
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
            {displayImages.length > 0 && (
              <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                {displayImages.length} image{displayImages.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {showingBuiltIn
              ? 'Showing built-in shop carousel - upload to replace'
              : description}
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
            <div>
              <label style={fieldLabel}>Hero images (unlimited)</label>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  void uploadFiles(e.dataTransfer.files)
                }}
                onClick={() => !uploading && fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#032b24' : '#d1d5db'}`,
                  borderRadius: 10,
                  background: dragOver ? '#f0fdf4' : '#fafafa',
                  padding: 16,
                  marginBottom: 12,
                  cursor: uploading ? 'wait' : 'pointer',
                  textAlign: 'center',
                }}
              >
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#111827', fontWeight: 500 }}>
                  {uploading ? 'Uploading…' : 'Drop images here or click to add'}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                  No limit - add as many as you want. Carousel order = left to right.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files?.length) void uploadFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </div>

              {customImages.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10, marginBottom: 12 }}>
                  {customImages.map((url, i) => (
                    <div
                      key={`${url}-${i}`}
                      style={{
                        border: previewIndex === i ? '2px solid #032b24' : '1px solid #e5e7eb',
                        borderRadius: 8,
                        overflow: 'hidden',
                        background: '#f9fafb',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewIndex(i)}
                        style={{ display: 'block', width: '100%', padding: 0, border: 'none', cursor: 'pointer' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }} />
                      </button>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', fontSize: 11 }}>
                        <span style={{ color: '#6b7280' }}>#{i + 1}</span>
                        <span style={{ display: 'flex', gap: 4 }}>
                          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={miniBtn}>
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => move(i, 1)}
                            disabled={i === customImages.length - 1}
                            style={miniBtn}
                          >
                            ↓
                          </button>
                          <button type="button" onClick={() => removeAt(i)} style={{ ...miniBtn, color: '#b91c1c' }}>
                            ✕
                          </button>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showingBuiltIn && (
                <p style={{ fontSize: '0.75rem', color: '#0369a1', margin: '0 0 12px' }}>
                  Currently using {builtIns.length} built-in image{builtIns.length === 1 ? '' : 's'}. Upload yours to
                  take over the carousel.
                </p>
              )}

              {customImages.length > 0 && (
                <button type="button" onClick={clearCustomImages} style={{ ...linkBtn, marginBottom: 16 }}>
                  Clear custom images (revert to built-in)
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

            <div>
              <div style={{ ...fieldLabel, marginBottom: 8 }}>
                Live preview{previewSlides.length > 1 ? ` (${(previewIndex % previewSlides.length) + 1}/${previewSlides.length})` : ''}
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff', minHeight: 220 }}>
                <div
                  style={{
                    fontSize: '0.625rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#9ca3af',
                    padding: '8px 12px',
                    borderBottom: '1px solid #f3f4f6',
                    background: '#fafafa',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    {isCategoryHero ? `${heading} category page` : isHomeHero ? 'Home hero' : heading}
                    {!form.active ? ' (inactive)' : ''}
                  </span>
                  {previewSlides.length > 1 && (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button type="button" style={miniBtn} onClick={() => setPreviewIndex((i) => (i - 1 + previewSlides.length) % previewSlides.length)}>
                        ‹
                      </button>
                      <button type="button" style={miniBtn} onClick={() => setPreviewIndex((i) => (i + 1) % previewSlides.length)}>
                        ›
                      </button>
                    </span>
                  )}
                </div>

                {isCategoryHero ? (
                  <CategoryPreview
                    title={heading}
                    line1={form.title || builtInLine1 || ''}
                    line2={form.subtitle || builtInLine2 || ''}
                    intro={form.ctaLabel || defaultIntro || ''}
                    imageUrl={activeSlide}
                    active={form.active}
                    usingBuiltInStory={!form.title.trim()}
                    usingBuiltInImage={showingBuiltIn}
                  />
                ) : isHomeHero ? (
                  <HomePreview
                    title={form.title || "Diamonds You'll Actually Wear."}
                    subtitle={
                      form.subtitle ||
                      'Minimal diamond jewellery designed for work, coffee runs, date nights and everyday confidence.'
                    }
                    cta={form.ctaLabel || 'Shop Now'}
                    imageUrl={activeSlide}
                    active={form.active}
                    usingBuiltInImage={showingBuiltIn}
                  />
                ) : (
                  <SimplePreview title={form.title || 'Promo text'} subtitle={form.subtitle} imageUrl={activeSlide} active={form.active} />
                )}
              </div>
              <p style={{ fontSize: '0.6875rem', color: '#9ca3af', margin: '8px 0 0' }}>
                Preview updates as you add images. Save to publish the full carousel.
              </p>
            </div>
          </div>

          <style>{`
            @media (max-width: 860px) {
              .content-editor-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </form>
      )}
    </div>
  )
}

const miniBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: '0 2px',
  fontSize: 11,
  color: '#374151',
}

const linkBtn: React.CSSProperties = {
  padding: 0,
  border: 'none',
  background: 'none',
  color: '#b91c1c',
  fontSize: '0.75rem',
  cursor: 'pointer',
}

function CategoryPreview({
  title,
  line1,
  line2,
  intro,
  imageUrl,
  active,
  usingBuiltInStory,
  usingBuiltInImage,
}: {
  title: string
  line1: string
  line2: string
  intro: string
  imageUrl: string
  active: boolean
  usingBuiltInStory?: boolean
  usingBuiltInImage?: boolean
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr', minHeight: 200, opacity: active ? 1 : 0.55 }}>
      <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
        <p style={{ margin: 0, fontSize: '0.625rem', color: '#9ca3af' }}>Home / {title}</p>
        {usingBuiltInStory && (
          <p style={{ margin: 0, fontSize: '0.625rem', color: '#0369a1', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Sample built-in story (rotates on site)
          </p>
        )}
        {line1 ? (
          <p style={{ margin: 0, fontFamily: serif, fontSize: '1.05rem', lineHeight: 1.4, color: '#111827' }}>{line1}</p>
        ) : (
          <p style={{ margin: 0, fontFamily: serif, fontSize: '1.05rem', color: '#9ca3af', fontStyle: 'italic' }}>
            Rotating built-in story will show here
          </p>
        )}
        {line2 && <p style={{ margin: 0, fontFamily: serif, fontSize: '1.05rem', lineHeight: 1.4, color: '#111827' }}>{line2}</p>}
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.45 }}>{intro || 'Category intro text...'}</p>
      </div>
      <div style={{ background: '#f3f4f6', minHeight: 200, position: 'relative' }}>
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
            {usingBuiltInImage && (
              <span style={builtInBadge}>Built-in</span>
            )}
          </>
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
  usingBuiltInImage,
}: {
  title: string
  subtitle: string
  cta: string
  imageUrl: string
  active: boolean
  usingBuiltInImage?: boolean
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 200, opacity: active ? 1 : 0.55 }}>
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
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
            {usingBuiltInImage && <span style={builtInBadge}>Built-in</span>}
          </>
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

const builtInBadge: React.CSSProperties = {
  position: 'absolute',
  left: 8,
  bottom: 8,
  background: 'rgba(3,105,161,0.92)',
  color: '#fff',
  fontSize: '0.625rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '4px 8px',
  borderRadius: 4,
}
