'use client'
import { useState, useRef } from 'react'
import Image from 'next/image'
import { isVideo } from '@/lib/imageUrl'

type Props = {
  media: string[]
  productName: string
}

export default function MediaGallery({ media, productName }: Props) {
  const [active, setActive] = useState(0)

  if (!media.length) {
    return (
      <div className="aspect-square bg-brand-cream rounded-sm flex items-center justify-center">
        <span className="font-display text-8xl text-brand-gold/10">V</span>
      </div>
    )
  }

  const current = media[active]
  const isCurrentVideo = isVideo(current)
  const touchStartX = useRef(0)

  function prev() { setActive((active - 1 + media.length) % media.length) }
  function next() { setActive((active + 1) % media.length) }

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) < 50) return
    diff > 0 ? next() : prev()
  }

  return (
    <div className="space-y-3">
      {/* Main display */}
      <div className="aspect-square bg-brand-cream rounded-sm overflow-hidden relative group" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {isCurrentVideo ? (
          <video
            key={current}
            src={current}
            controls
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <Image
            src={current}
            alt={productName}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        )}

        {/* Prev / Next arrows (only if multiple media) */}
        {media.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-gray-700 shadow transition-opacity opacity-0 group-hover:opacity-100"
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-gray-700 shadow transition-opacity opacity-0 group-hover:opacity-100"
              aria-label="Next"
            >
              ›
            </button>
          </>
        )}

        {/* Counter */}
        {media.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full">
            {active + 1} / {media.length}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {media.length > 1 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(media.length, 5)}, 1fr)` }}>
          {media.map((url, i) => {
            const isVid = isVideo(url)
            return (
              <button
                key={url}
                onClick={() => setActive(i)}
                className={`aspect-square rounded-sm overflow-hidden relative border-2 transition-colors ${
                  i === active ? 'border-brand-gold' : 'border-transparent hover:border-brand-gold/40'
                }`}
              >
                {isVid ? (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                ) : (
                  <Image
                    src={url}
                    alt={`${productName} ${i + 1}`}
                    fill
                    sizes="15vw"
                    className="object-cover"
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
