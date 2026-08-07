'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ProductImage } from '@/components/ui/ProductImage'

type Props = {
  images: string[]
  productName?: string
  onChange?: (images: string[]) => void
}

type GalleryItem = { src: string; index: number; isVideo: boolean }
type PreviewMode = 'web' | 'mobile'

function isVideo(src: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(src)
}

/**
 * Single-pane storefront preview: dropdown switches Web ↔ Mobile.
 * Adjustments (reorder / remove / set front) write back via onChange.
 */
export function AdminProductGalleryPreview({
  images,
  productName = 'Product',
  onChange,
}: Props) {
  const gallery = useMemo<GalleryItem[]>(
    () =>
      images
        .map((src, index) => ({ src, index, isVideo: isVideo(src) }))
        .filter((m) => Boolean(m.src)),
    [images],
  )

  const [mode, setMode] = useState<PreviewMode>('web')
  const [active, setActive] = useState(0)
  const swipeRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  useEffect(() => {
// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync reset, pre-compiler pattern
    if (active >= gallery.length) setActive(Math.max(0, gallery.length - 1))
  }, [gallery.length, active])

  useEffect(() => {
    if (mode !== 'mobile') return
    const el = swipeRef.current
    if (!el) return
    const onScroll = () => {
      if (syncingRef.current) return
      const w = el.clientWidth
      if (w <= 0) return
      setActive(Math.round(el.scrollLeft / w))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [mode])

  const scrollMobileTo = (index: number) => {
    setActive(index)
    const el = swipeRef.current
    if (!el) return
    syncingRef.current = true
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
    window.setTimeout(() => {
      syncingRef.current = false
    }, 350)
  }

  useEffect(() => {
    if (mode !== 'mobile') return
    const el = swipeRef.current
    if (!el) return
    const w = el.clientWidth
    if (w <= 0) return
    const target = active * w
    if (Math.abs(el.scrollLeft - target) > 8) {
      syncingRef.current = true
      el.scrollTo({ left: target, behavior: 'smooth' })
      window.setTimeout(() => {
        syncingRef.current = false
      }, 350)
    }
  }, [active, mode])

  function writeGallery(nextGallery: GalleryItem[]) {
    if (!onChange) return
    const filled = nextGallery.map((g) => g.src)
    const filledPositions = images
      .map((src, i) => (src ? i : -1))
      .filter((i) => i >= 0)

    if (filledPositions.length === filled.length) {
      const rebuilt = [...images]
      filledPositions.forEach((pos, i) => {
        rebuilt[pos] = filled[i] ?? ''
      })
      let end = Math.max(4, rebuilt.length - 1)
      while (end > 4 && !rebuilt[end]) end--
      onChange(rebuilt.slice(0, end + 1))
      return
    }

    const packed: string[] = ['', '', '', '', '']
    filled.forEach((src, i) => {
      if (i < 5) packed[i] = src
      else packed.push(src)
    })
    onChange(packed)
  }

  function moveActive(delta: -1 | 1) {
    if (!onChange || gallery.length < 2) return
    const from = active
    const to = from + delta
    if (to < 0 || to >= gallery.length) return
    const next = [...gallery]
    const tmp = next[from]
    next[from] = next[to]
    next[to] = tmp
    writeGallery(next)
    setActive(to)
  }

  function setActiveAsFront() {
    if (!onChange || gallery.length < 2 || active === 0) return
    const next = [...gallery]
    const [item] = next.splice(active, 1)
    next.unshift(item)
    writeGallery(next)
    setActive(0)
  }

  if (gallery.length === 0) {
    return (
      <div className="admin-gallery-preview admin-gallery-preview--empty">
        Storefront preview will appear here once you add images.
      </div>
    )
  }

  const current = gallery[active] ?? gallery[0]
  const canEdit = Boolean(onChange)

  return (
    <div className="admin-gallery-preview">
      <div className="admin-gallery-preview__toolbar">
        <div className="admin-gallery-preview__toolbar-left">
          <p className="admin-gallery-preview__heading">Storefront preview</p>
          <label className="admin-gallery-preview__mode">
            <span className="admin-gallery-preview__mode-label">View</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as PreviewMode)}
              className="admin-gallery-preview__select"
              aria-label="Preview device"
            >
              <option value="web">Web</option>
              <option value="mobile">Mobile</option>
            </select>
          </label>
        </div>

        {canEdit && (
          <div className="admin-gallery-preview__actions">
            <button type="button" onClick={() => moveActive(-1)} disabled={active === 0} title="Move earlier">
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveActive(1)}
              disabled={active >= gallery.length - 1}
              title="Move later"
            >
              ↓
            </button>
            <button type="button" onClick={setActiveAsFront} disabled={active === 0} title="Set as Front">
              Set Front
            </button>
          </div>
        )}
      </div>

      <p className="admin-gallery-preview__hint">
        {mode === 'web' ? 'Desktop PDP gallery' : 'Mobile PDP gallery'} · slide {active + 1} of{' '}
        {gallery.length}
        {current.isVideo ? ' · Video' : ''}
      </p>

      <div className="admin-gallery-preview__stage">
        {mode === 'web' ? (
          <section className="admin-gallery-preview__panel admin-gallery-preview__panel--web">
            <div className="admin-gallery-preview__web">
              <div className="pdp-gallery__thumbs admin-gallery-preview__thumbs">
                {gallery.map((media, i) => (
                  <button
                    key={`web-${media.index}-${media.src}`}
                    type="button"
                    className={[active === i ? 'is-active' : '', media.isVideo ? 'pdp-thumb--video' : '']
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setActive(i)}
                    aria-label={media.isVideo ? `Video ${i + 1}` : `Image ${i + 1}`}
                  >
                    {media.isVideo ? (
                      <video
                        src={media.src}
                        muted
                        playsInline
                        preload="metadata"
                        style={{ width: 64, height: 64, objectFit: 'cover' }}
                      />
                    ) : (
                      <ProductImage src={media.src} alt="" width={64} height={64} />
                    )}
                  </button>
                ))}
              </div>
              <div className="pdp-gallery__main admin-gallery-preview__web-main">
                {current.isVideo ? (
                  <video
                    key={current.src}
                    src={current.src}
                    muted
                    loop
                    playsInline
                    autoPlay
                    controls
                    className="pdp-gallery__video"
                  />
                ) : (
                  <ProductImage src={current.src} alt={productName} width={1200} height={1200} />
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="admin-gallery-preview__panel admin-gallery-preview__panel--mobile">
            <div className="admin-gallery-preview__phone">
              <div className="admin-gallery-preview__phone-bezel">
                <div className="admin-gallery-preview__phone-notch" />
                <div className="admin-gallery-preview__phone-screen">
                  <div className="admin-gallery-preview__mobile-gallery">
                    <div
                      className="admin-gallery-preview__swipe"
                      ref={swipeRef}
                      aria-label="Product images"
                    >
                      {gallery.map((media, i) => (
                        <div
                          key={`m-${media.index}-${media.src}`}
                          className="admin-gallery-preview__slide"
                        >
                          {media.isVideo ? (
                            <video
                              src={media.src}
                              muted
                              loop
                              playsInline
                              autoPlay={active === i}
                              controls
                              className="admin-gallery-preview__slide-media"
                            />
                          ) : (
                            <img
                              src={media.src}
                              alt={i === 0 ? productName : ''}
                              className="admin-gallery-preview__slide-media"
                              draggable={false}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    {gallery.length > 1 && (
                      <div className="admin-gallery-preview__dots" role="tablist">
                        {gallery.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            role="tab"
                            aria-selected={active === i}
                            className={active === i ? 'is-active' : ''}
                            onClick={() => scrollMobileTo(i)}
                            aria-label={`Image ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="admin-gallery-preview__phone-hint">
                Swipe or tap dots · phone width 375px
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
