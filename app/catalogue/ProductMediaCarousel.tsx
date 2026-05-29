'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CatalogueMedia } from '@/lib/catalogue-feed'
import { prefetchCatalogueMedia } from '@/lib/catalogue-prefetch'
import { IconChevronLeft, IconChevronRight } from '@/components/catalogue/CatalogueIcons'

type Props = {
  media: CatalogueMedia[]
  productName: string
  isActive: boolean
  initialMediaIndex?: number
  onMediaIndexChange?: (index: number) => void
  /** When false, side tap zones are hidden (e.g. comment step open). */
  allowPhotoNav?: boolean
}

function CatalogueVideo({
  url,
  playing,
  priority,
}: {
  url: string
  playing: boolean
  priority?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    prefetchCatalogueMedia(url, true)
  }, [url])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (playing) el.play().catch(() => {})
    else el.pause()
  }, [playing, url])

  const onCanPlay = () => {
    setReady(true)
    if (playing) ref.current?.play().catch(() => {})
  }

  return (
    <video
      ref={ref}
      src={url}
      loop
      muted
      playsInline
      preload={priority ? 'auto' : 'metadata'}
      onLoadedData={() => setReady(true)}
      onCanPlay={onCanPlay}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
        ready ? 'opacity-100' : 'opacity-0'
      }`}
    />
  )
}

function CatalogueImage({
  url,
  alt,
  priority,
}: {
  url: string
  alt: string
  priority?: boolean
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    prefetchCatalogueMedia(url, false)
  }, [url])

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      onLoad={() => setReady(true)}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
        ready ? 'opacity-100' : 'opacity-0'
      }`}
    />
  )
}

export default function ProductMediaCarousel({
  media,
  productName,
  isActive,
  initialMediaIndex = 0,
  onMediaIndexChange,
  allowPhotoNav = true,
}: Props) {
  const [mediaIndex, setMediaIndex] = useState(initialMediaIndex)
  const hasMultiple = media.length > 1
  const canPrev = mediaIndex > 0
  const canNext = mediaIndex < media.length - 1

  useEffect(() => {
    if (!isActive) return
    setMediaIndex(initialMediaIndex)
  }, [isActive, initialMediaIndex])

  const goTo = useCallback(
    (idx: number) => {
      const next = Math.max(0, Math.min(media.length - 1, idx))
      setMediaIndex(next)
      onMediaIndexChange?.(next)
    },
    [media.length, onMediaIndexChange]
  )

  useEffect(() => {
    if (!isActive) return
    for (const i of [mediaIndex - 1, mediaIndex, mediaIndex + 1]) {
      if (i >= 0 && i < media.length) {
        prefetchCatalogueMedia(media[i].url, media[i].isVideo)
      }
    }
  }, [isActive, media, mediaIndex])

  if (media.length === 0) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-brand-cream/10 to-black flex items-center justify-center">
        <span className="font-display text-6xl text-brand-gold/15">V</span>
      </div>
    )
  }

  const item = media[mediaIndex]
  const playing = isActive && item.isVideo

  return (
    <>
      <div className="absolute inset-0 bg-black">
        {isActive ? (
          item.isVideo ? (
            <CatalogueVideo url={item.url} playing={playing} priority />
          ) : (
            <CatalogueImage url={item.url} alt={`${productName} — ${mediaIndex + 1}`} priority />
          )
        ) : null}
      </div>

      {hasMultiple && isActive && allowPhotoNav && (
        <>
          {/* Left tap zone + arrow — arrow at top-[30%], not flex-centered */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goTo(mediaIndex - 1) }}
            disabled={!canPrev}
            aria-label="Previous photo"
            className="absolute left-0 top-0 bottom-48 w-[28%] z-20 disabled:pointer-events-none touch-manipulation"
          >
            <span className={`absolute left-2 top-[30%] w-9 h-9 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-md transition-opacity ${canPrev ? 'opacity-80 active:opacity-100' : 'opacity-0'}`}>
              <IconChevronLeft className="w-4 h-4 text-white" />
            </span>
          </button>

          {/* Right tap zone + arrow */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goTo(mediaIndex + 1) }}
            disabled={!canNext}
            aria-label="Next photo"
            className="absolute right-16 top-0 bottom-48 w-[28%] z-20 disabled:pointer-events-none touch-manipulation"
          >
            <span className={`absolute right-2 top-[30%] w-9 h-9 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-md transition-opacity ${canNext ? 'opacity-80 active:opacity-100' : 'opacity-0'}`}>
              <IconChevronRight className="w-4 h-4 text-white" />
            </span>
          </button>

          {/* Dot indicators */}
          <div className="absolute top-[68px] left-0 right-0 z-20 flex justify-center gap-1.5 pointer-events-none">
            {media.map((m, i) => (
              <span
                key={i}
                className={`h-[3px] rounded-full transition-all duration-300 ${
                  i === mediaIndex
                    ? m.isVideo ? 'w-5 bg-white' : 'w-5 bg-brand-gold'
                    : 'w-[5px] bg-white/30'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}
