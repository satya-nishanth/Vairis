'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const SLIDES = [
  {
    src: '/images/website-assets/hero-1.jpeg',
    alt: 'Model wearing VAIRIS earrings',
    headline: 'Where heritage meets\nthe extraordinary.',
    sub: 'Earrings Collection',
    href: '/shop/earrings',
    cta: 'Discover Earrings',
    // Dark green bg on right → gold accent readable
    accentColor: '#c9a84c',
    subColor: 'rgba(201,168,76,0.75)',
  },
  {
    src: '/images/website-assets/hero-2.jpeg',
    alt: 'VAIRIS bracelet lifestyle',
    headline: 'Crafted with precision.\nWorn with pride.',
    sub: 'Bracelets Collection',
    href: '/shop/bracelets',
    cta: 'Shop Bracelets',
    // Warm cream bg → strong dark overlay, use white accent (gold invisible)
    accentColor: '#ffffff',
    subColor: 'rgba(255,255,255,0.65)',
  },
  {
    src: '/images/website-assets/hero-3.jpeg',
    alt: 'VAIRIS pendant gifting moment',
    headline: 'Fine jewellery,\nreimagined.',
    sub: 'Pendants Collection',
    href: '/shop/pendants',
    cta: 'Explore Pendants',
    // Warm golden bokeh → gold barely visible, use white
    accentColor: '#ffffff',
    subColor: 'rgba(255,255,255,0.65)',
  },
]

// Strong dark-right gradient ensures text readability on ALL backgrounds
const OVERLAY =
  'linear-gradient(to left, rgba(15,36,24,0.92) 0%, rgba(15,36,24,0.72) 38%, rgba(15,36,24,0.3) 62%, rgba(15,36,24,0.05) 100%)'

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(0)        // image currently shown
  const [allLoaded, setAllLoaded] = useState(false)
  const loadedCount = useRef(0)

  // Track when all 3 images finish loading
  const handleImageLoad = useCallback(() => {
    loadedCount.current += 1
    if (loadedCount.current >= SLIDES.length) setAllLoaded(true)
  }, [])

  // Crossfade: set current immediately (for text), delay image switch
  const goTo = useCallback(
    (idx: number) => {
      setCurrent(idx)
      // Brief delay so next image is painted before fading in
      setTimeout(() => setVisible(idx), 50)
    },
    []
  )

  // Auto-advance only after all images are loaded
  useEffect(() => {
    if (!allLoaded) return
    const t = setInterval(() => {
      goTo((current + 1) % SLIDES.length)
    }, 5500)
    return () => clearInterval(t)
  }, [allLoaded, current, goTo])

  const slide = SLIDES[current]

  return (
    <section
      className="relative w-full overflow-hidden select-none"
      style={{ height: 'min(88vh, 700px)' }}
    >
      {/* ── All images stacked — opacity switch eliminates flicker ── */}
      {SLIDES.map((s, i) => (
        <div
          key={s.src}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === visible ? 1 : 0 }}
        >
          <Image
            src={s.src}
            alt={s.alt}
            fill
            priority             // all 3 preloaded — no lazy loading
            sizes="100vw"
            quality={80}
            className="object-cover object-left-top"
            onLoad={handleImageLoad}
          />
        </div>
      ))}

      {/* ── Dark-right overlay — works on every background ── */}
      <div className="absolute inset-0" style={{ background: OVERLAY }} />

      {/* ── Text — always RIGHT aligned ── */}
      <div className="absolute inset-0 flex items-center justify-end">
        <div
          className="px-8 md:px-16 lg:px-20 space-y-5 max-w-md xl:max-w-lg transition-all duration-500"
          style={{
            opacity: visible === current ? 1 : 0,
            transform: visible === current ? 'translateY(0)' : 'translateY(12px)',
            textAlign: 'right',
          }}
        >
          {/* VAIRIS logo on every slide */}
          <div className="flex justify-end mb-1">
            <img
              src="/images/vairius_logo.png"
              alt="VAIRIS"
              style={{ height: '36px', width: 'auto', opacity: 0.9 }}
            />
          </div>

          {/* Collection label */}
          <p
            className="tracking-[0.4em] text-xs uppercase"
            style={{ color: slide.subColor, fontFamily: 'var(--font-body)', fontWeight: 400 }}
          >
            {slide.sub}
          </p>

          {/* Headline */}
          <h1
            className="text-white leading-tight"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(26px, 4vw, 54px)',
              fontWeight: 300,
              letterSpacing: '0.02em',
              whiteSpace: 'pre-line',
              textShadow: '0 2px 20px rgba(0,0,0,0.4)',
            }}
          >
            {slide.headline}
          </h1>

          {/* Gold accent divider — right-aligned */}
          <div
            className="h-px ml-auto"
            style={{
              width: '80px',
              background: `linear-gradient(to left, transparent, ${slide.accentColor}88, ${slide.accentColor})`,
            }}
          />

          {/* CTA button */}
          <div className="flex justify-end">
            <Link
              href={slide.href}
              className="inline-block transition-all duration-300 hover:scale-105"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(11px, 1.4vw, 13px)',
                fontWeight: 300,
                letterSpacing: '0.4em',
                padding: '14px 36px',
                border: `1px solid ${slide.accentColor}88`,
                color: slide.accentColor,
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLAnchorElement).style.background = slide.accentColor
                ;(e.currentTarget as HTMLAnchorElement).style.color =
                  slide.accentColor === '#ffffff' ? '#0f2418' : '#0f2418'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLAnchorElement).style.color = slide.accentColor
              }}
            >
              {slide.cta.toUpperCase()}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Loading indicator until all images ready ── */}
      {!allLoaded && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      )}

      {/* ── Dot navigation — bottom center ── */}
      {allLoaded && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="transition-all duration-300 focus:outline-none"
              style={{
                width: i === current ? '28px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background:
                  i === current
                    ? '#c9a84c'
                    : 'rgba(255,255,255,0.35)',
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* ── Slide counter — bottom right ── */}
      <div
        className="absolute bottom-6 right-8 text-white/30 text-xs tracking-widest"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
      >
        {String(current + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
      </div>
    </section>
  )
}
