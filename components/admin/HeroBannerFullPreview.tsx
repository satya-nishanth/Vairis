'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Icon } from '@iconify/react'

export const MOBILE_HERO_ASPECT = '390 / 720'
export const WEB_HERO_ASPECT = '2 / 1'

const OVERLAY_DB =
  'linear-gradient(to top, rgba(8,22,14,0.35) 0%, rgba(8,22,14,0.08) 60%, transparent 100%)'

export type PreviewSlide = { id: string; url: string }

type Props = {
  variant: 'mobile' | 'web'
  slides: PreviewSlide[]
}

export default function HeroBannerFullPreview({ variant, slides }: Props) {
  const [current, setCurrent] = useState(0)
  const isMobile = variant === 'mobile'
  const slideKey = slides.map((s) => s.id).join(',')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync reset, pre-compiler pattern
    setCurrent(0)
  }, [slideKey])

  useEffect(() => {
    if (slides.length <= 1) return
    const t = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 5500)
    return () => clearInterval(t)
  }, [slides.length])

  const frameClass = isMobile
    ? 'w-full max-w-[390px] mx-auto'
    : 'w-full max-w-6xl mx-auto'

  const frameStyle = isMobile
    ? { height: 'min(90vh, 720px)' }
    : { aspectRatio: WEB_HERO_ASPECT, maxHeight: 'min(90vh, 720px)' }

  return (
    <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col">
      <header className="shrink-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-4">
        <Link
          href="/admin/hero-images"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-gold transition-colors"
        >
          <Icon icon="carbon:arrow-left" width={18} height={18} />
          Back to slides
        </Link>
        <div className="text-center">
          <p className="text-[10px] text-gray-400 tracking-widest uppercase">
            Banner preview · {isMobile ? 'Mobile' : 'Web'}
          </p>
          {slides.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              Slide {current + 1} of {slides.length}
            </p>
          )}
        </div>
        <Link
          href={`/admin/hero-images/preview/${isMobile ? 'web' : 'mobile'}`}
          className="text-xs tracking-widest uppercase text-brand-gold hover:underline"
        >
          View {isMobile ? 'Web' : 'Mobile'}
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        {slides.length === 0 ? (
          <div className="text-center">
            <p className="font-display text-xl text-gray-400 mb-2">No slides uploaded</p>
            <Link href="/admin/hero-images" className="text-sm text-brand-gold hover:underline">
              Upload hero images →
            </Link>
          </div>
        ) : (
          <div
            className={`relative overflow-hidden rounded-lg border border-gray-200 bg-brand-dark shadow-lg ${frameClass}`}
            style={frameStyle}
          >
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                className="absolute inset-0 transition-opacity duration-700"
                style={{ opacity: i === current ? 1 : 0 }}
              >
                <Image
                  src={slide.url}
                  alt={`Hero slide ${i + 1}`}
                  fill
                  className="object-cover object-center"
                  sizes={isMobile ? '390px' : '1200px'}
                  priority={i === 0}
                />
              </div>
            ))}
            <div className="absolute inset-0 pointer-events-none" style={{ background: OVERLAY_DB }} />

            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrent((c) => (c - 1 + slides.length) % slides.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                  aria-label="Previous slide"
                >
                  <Icon icon="carbon:chevron-left" width={20} height={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrent((c) => (c + 1) % slides.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                  aria-label="Next slide"
                >
                  <Icon icon="carbon:chevron-right" width={20} height={20} />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                  {slides.map((slide, i) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setCurrent(i)}
                      aria-label={`Go to slide ${i + 1}`}
                      className="block rounded-full transition-all duration-300"
                      style={{
                        width: i === current ? '24px' : '6px',
                        height: '6px',
                        background: i === current ? '#c9a84c' : 'rgba(255,255,255,0.4)',
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
