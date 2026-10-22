'use client'

import { useEffect, useRef, useState } from 'react'
import { BannerStorefrontPreview } from '@/components/admin/BannerStorefrontPreview'
import {
  DEFAULT_BANNER_FIT,
  defaultFitsFor,
  normalizeImageFits,
  type BannerImageFit,
} from '@/lib/banner-image-fit'

type BannerForm = {
  title: string
  subtitle: string
  images: string[]
  imageFits: BannerImageFit[]
  linkUrl: string
  ctaLabel: string
  active: boolean
}

const EMPTY: BannerForm = {
  title: '',
  subtitle: '',
  images: [],
  imageFits: [],
  linkUrl: '',
  ctaLabel: '',
  active: true,
}

const siteFont = 'var(--font-sans)'

/**
 * Full-page banner editor: unlimited carousel uploads + live storefront preview.
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

  const [form, setForm] = useState<BannerForm>(() => {
    if (!initial) return EMPTY
    return {
      ...initial,
      imageFits: normalizeImageFits(initial.images, initial.imageFits),
    }
  })
  const [savedImages, setSavedImages] = useState<string[]>(initial?.images ?? [])
  const [savedFits, setSavedFits] = useState<BannerImageFit[]>(
    normalizeImageFits(initial?.images ?? [], initial?.imageFits),
  )
  const [localPreviews, setLocalPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewMode, setPreviewMode] = useState<'web' | 'mobile'>('web')
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
  const displayFits = normalizeImageFits(
    displayImages,
    customImages.length > 0 ? form.imageFits : defaultFitsFor(builtIns.length),
  )
  const previewSlides = [...displayImages, ...localPreviews]
  const previewFits = [
    ...displayFits,
    ...localPreviews.map(() => ({ ...DEFAULT_BANNER_FIT })),
  ]

  const fitsChanged =
    form.imageFits.length !== savedFits.length ||
    form.imageFits.some((f, i) => {
      const s = savedFits[i]
      if (!s) return true
      return (
        f.webX !== s.webX ||
        f.webY !== s.webY ||
        f.mobileX !== s.mobileX ||
        f.mobileY !== s.mobileY
      )
    })
  const imagesChanged =
    customImages.length !== savedImages.length ||
    customImages.some((u, i) => u !== savedImages[i]) ||
    fitsChanged
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
        const res = await fetch(`/api/admin/upload`, { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) {
          setMessage(json.error ?? 'Upload failed')
          setMessageOk(false)
          break
        }
        uploaded.push(json.url as string)
      }
      if (uploaded.length) {
        setForm((f) => {
          const baseImages = editableImages(f.images)
          const baseFits = normalizeImageFits(baseImages, f.imageFits.length ? f.imageFits : displayFits)
          return {
            ...f,
            images: [...baseImages, ...uploaded],
            imageFits: [...baseFits, ...defaultFitsFor(uploaded.length)],
          }
        })
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
      const images = form.images
      const imageFits = normalizeImageFits(images, form.imageFits)
      const res = await fetch(`/api/admin/content/${slot}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          subtitle: form.subtitle,
          images,
          imageFits,
          imageUrl: images[0] ?? '',
          linkUrl: form.linkUrl,
          ctaLabel: form.ctaLabel,
          active: form.active,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setForm((f) => ({ ...f, imageFits }))
        setSavedImages([...images])
        setSavedFits(imageFits)
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

  /** Built-ins are read-only until edited — copy into form so order/fit can be saved. */
  function editableImages(current: string[]): string[] {
    return current.length > 0 ? [...current] : [...builtIns]
  }

  function editablePair(f: BannerForm): { images: string[]; imageFits: BannerImageFit[] } {
    const images = editableImages(f.images)
    const imageFits = normalizeImageFits(
      images,
      f.images.length > 0 ? f.imageFits : displayFits,
    )
    return { images, imageFits }
  }

  function removeAt(index: number) {
    setForm((f) => {
      const { images, imageFits } = editablePair(f)
      return {
        ...f,
        images: images.filter((_, i) => i !== index),
        imageFits: imageFits.filter((_, i) => i !== index),
      }
    })
    setPreviewIndex((i) => {
      if (i > index) return i - 1
      if (i === index) return Math.max(0, index - 1)
      return i
    })
  }

  function move(index: number, dir: -1 | 1) {
    setForm((f) => {
      const { images, imageFits } = editablePair(f)
      const j = index + dir
      if (j < 0 || j >= images.length) return f
      ;[images[index], images[j]] = [images[j], images[index]]
      ;[imageFits[index], imageFits[j]] = [imageFits[j], imageFits[index]]
      return { ...f, images, imageFits }
    })
    setPreviewIndex((i) => {
      if (i === index) return index + dir
      if (i === index + dir) return index
      return i
    })
  }

  function moveToFront(index: number) {
    if (index <= 0) return
    setForm((f) => {
      const { images, imageFits } = editablePair(f)
      const [item] = images.splice(index, 1)
      const [fit] = imageFits.splice(index, 1)
      images.unshift(item)
      imageFits.unshift(fit)
      return { ...f, images, imageFits }
    })
    setPreviewIndex(0)
  }

  function updateFit(index: number, fit: BannerImageFit) {
    setForm((f) => {
      const { images, imageFits } = editablePair(f)
      if (index < 0 || index >= images.length) return f
      const nextFits = [...imageFits]
      nextFits[index] = fit
      return { ...f, images, imageFits: nextFits }
    })
  }

  function clearCustomImages() {
    setForm((f) => ({ ...f, images: [], imageFits: [] }))
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
    <div className="content-editor">
      <div className="content-editor__head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 className="admin-page__title" style={{ marginBottom: 0 }}>
              {heading}
            </h1>
            <span
              style={{
                fontSize: '0.625rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '3px 10px',
                borderRadius: 999,
                background: `${statusColor}18`,
                color: statusColor,
                fontWeight: 600,
              }}
            >
              {statusLabel}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
            {showingBuiltIn ? 'Showing built-in shop carousel - upload to replace' : description}
          </p>
        </div>
      </div>

      <form onSubmit={save} className="content-editor__form">
          <div className="content-editor-grid">
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

              {displayImages.length > 0 && (
                <div className="banner-order">
                  <label style={fieldLabel}>Carousel order</label>
                  <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: '#6b7280' }}>
                    Click a thumb to preview. Use ↑↓ or First to change play order — Save to publish on the
                    banner.
                    {showingBuiltIn
                      ? ' Reordering keeps these built-in files but locks your new sequence.'
                      : ''}
                  </p>
                  <div className="banner-order__grid">
                    {displayImages.map((url, i) => (
                      <div
                        key={`${url}-${i}`}
                        className={
                          previewIndex === i
                            ? 'banner-order__card is-selected'
                            : 'banner-order__card'
                        }
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewIndex(i)}
                          className="banner-order__thumb"
                        >
                          { }
                          <img src={url} alt="" />
                          {i === 0 && <span className="banner-order__first-tag">1st</span>}
                        </button>
                        <div className="banner-order__meta">
                          <span>#{i + 1}</span>
                          <span className="banner-order__actions">
                            <button
                              type="button"
                              onClick={() => move(i, -1)}
                              disabled={i === 0}
                              style={miniBtn}
                              title="Move earlier"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => move(i, 1)}
                              disabled={i === displayImages.length - 1}
                              style={miniBtn}
                              title="Move later"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => moveToFront(i)}
                              disabled={i === 0}
                              style={miniBtn}
                              title="Set as first slide"
                            >
                              First
                            </button>
                            <button
                              type="button"
                              onClick={() => removeAt(i)}
                              style={{ ...miniBtn, color: '#b91c1c' }}
                              title="Remove"
                            >
                              ✕
                            </button>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showingBuiltIn && (
                <p style={{ fontSize: '0.75rem', color: '#0369a1', margin: '0 0 12px' }}>
                  Using default order. Reorder above or upload new images, then Save.
                </p>
              )}

              {customImages.length > 0 && (
                <button type="button" onClick={clearCustomImages} style={{ ...linkBtn, marginBottom: 16 }}>
                  Reset to default built-in order
                </button>
              )}

              {isCategoryHero ? (
                <>
                  <label style={fieldLabel}>Headline line 1</label>
                  <textarea
                    style={{ ...field, minHeight: 64, resize: 'vertical', fontFamily: siteFont, fontSize: '1rem' }}
                    value={form.title}
                    onChange={set('title')}
                    placeholder="She bought it after her first solo presentation."
                  />
                  <label style={fieldLabel}>Headline line 2</label>
                  <textarea
                    style={{ ...field, minHeight: 64, resize: 'vertical', fontFamily: siteFont, fontSize: '1rem' }}
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
                      <input style={field} value={form.linkUrl} onChange={set('linkUrl')} placeholder="/all-products/rings" />
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
              <BannerStorefrontPreview
                kind={isCategoryHero ? 'category' : isHomeHero ? 'home' : 'promo'}
                heading={heading}
                images={previewSlides}
                imageFits={previewFits}
                title={
                  isCategoryHero
                    ? form.title || builtInLine1 || ''
                    : form.title || (isHomeHero ? "Diamonds You'll Actually Wear." : 'Promo text')
                }
                subtitle={
                  isCategoryHero
                    ? form.subtitle || builtInLine2 || ''
                    : form.subtitle ||
                      (isHomeHero
                        ? 'Minimal diamond jewellery designed for work, coffee runs, date nights and everyday confidence.'
                        : '')
                }
                intro={isCategoryHero ? form.ctaLabel || defaultIntro || '' : undefined}
                ctaLabel={form.ctaLabel}
                linkUrl={form.linkUrl}
                active={form.active}
                usingBuiltInStory={isCategoryHero && !form.title.trim()}
                usingBuiltInImage={showingBuiltIn}
                slideIndex={previewIndex}
                onSlideIndexChange={setPreviewIndex}
                onFitChange={updateFit}
                previewMode={previewMode}
                onPreviewModeChange={setPreviewMode}
              />
            </div>
          </div>

          <style>{`
            .content-editor-grid {
              display: flex;
              flex-direction: column;
              gap: 24px;
            }
          `}</style>
        </form>
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
