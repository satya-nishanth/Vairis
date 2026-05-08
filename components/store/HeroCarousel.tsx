'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const SLIDES = [
  {
    src: '/images/website-assets/hero-1.jpeg',
    alt: 'Model wearing VAIRIS earrings',
    collection: 'Earrings',
    headline: 'Where heritage meets\nthe extraordinary.',
    href: '/shop/earrings',
    cta: 'Discover Earrings',
    // Dark green background — gold works
    gold: '#c9a84c',
    white: 'rgba(255,255,255,0.85)',
    dim: 'rgba(201,168,76,0.65)',
  },
  {
    src: '/images/website-assets/hero-2.jpeg',
    alt: 'VAIRIS bracelet lifestyle',
    collection: 'Bracelets',
    headline: 'Crafted with precision.\nWorn with pride.',
    href: '/shop/bracelets',
    cta: 'Shop Bracelets',
    // Cream background — use white, strong overlay handles contrast
    gold: '#ffffff',
    white: 'rgba(255,255,255,0.9)',
    dim: 'rgba(255,255,255,0.6)',
  },
  {
    src: '/images/website-assets/hero-3.jpeg',
    alt: 'VAIRIS pendant gifting moment',
    collection: 'Pendants',
    headline: 'Fine jewellery,\nreimagined.',
    href: '/shop/pendants',
    cta: 'Explore Pendants',
    // Warm golden bokeh — white
    gold: '#ffffff',
    white: 'rgba(255,255,255,0.9)',
    dim: 'rgba(255,255,255,0.6)',
  },
]

// Strong right-side dark gradient (desktop), bottom-heavy (mobile)
const OVERLAY_DESKTOP =
  'linear-gradient(to left, rgba(10,26,16,0.93) 0%, rgba(10,26,16,0.75) 40%, rgba(10,26,16,0.25) 65%, transparent 100%)'
const OVERLAY_MOBILE =
  'linear-gradient(to top, rgba(10,26,16,0.92) 0%, rgba(10,26,16,0.65) 50%, rgba(10,26,16,0.2) 100%)'

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(0)
  const [allLoaded, setAllLoaded] = useState(false)
  const loadedCount = useRef(0)

  const handleImageLoad = useCallback(() => {
    loadedCount.current += 1
    if (loadedCount.current >= SLIDES.length) setAllLoaded(true)
  }, [])

  const goTo = useCallback((idx: number) => {
    setCurrent(idx)
    setTimeout(() => setVisible(idx), 50)
  }, [])

  useEffect(() => {
    if (!allLoaded) return
    const t = setInterval(() => goTo((current + 1) % SLIDES.length), 5500)
    return () => clearInterval(t)
  }, [allLoaded, current, goTo])

  const s = SLIDES[current]

  return (
    <section className="relative w-full overflow-hidden" style={{ height: 'min(92vh, 760px)' }}>

      {/* ── All 3 images always in DOM ── */}
      {SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === visible ? 1 : 0 }}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            priority
            sizes="100vw"
            quality={82}
            className="object-cover object-center"
            onLoad={handleImageLoad}
          />
        </div>
      ))}

      {/* ── Mobile overlay (bottom-heavy) ── */}
      <div className="absolute inset-0 md:hidden" style={{ background: OVERLAY_MOBILE }} />
      {/* ── Desktop overlay (right-heavy) ── */}
      <div className="absolute inset-0 hidden md:block" style={{ background: OVERLAY_DESKTOP }} />

      {/* ── Text block ── */}
      {/* Mobile: centered bottom-half | Desktop: right side middle */}
      <div className="absolute inset-0 flex items-end md:items-center justify-center md:justify-end pb-16 md:pb-0">
        <div
          className="w-full md:w-auto px-6 md:px-14 lg:px-20"
          style={{
            maxWidth: '460px',
            opacity: visible === current ? 1 : 0,
            transform: visible === current ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.55s ease, transform 0.55s ease',
          }}
        >
          {/* Brand name */}
          <p
            className="text-center md:text-right"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(42px, 6.5vw, 78px)',
              fontWeight: 300,
              letterSpacing: '0.42em',
              lineHeight: 1,
              color: s.gold,
              textShadow: '0 2px 24px rgba(0,0,0,0.5)',
              marginBottom: '12px',
            }}
          >
            VAIRIS
          </p>

          {/* Divider line */}
          <div
            className="mx-auto md:ml-auto md:mr-0 mb-4"
            style={{
              width: '72px',
              height: '1px',
              background: `linear-gradient(to left, transparent, ${s.gold}90, ${s.gold})`,
            }}
          />

          {/* Collection label */}
          <p
            className="text-center md:text-right mb-5"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '10px',
              fontWeight: 400,
              letterSpacing: '0.38em',
              textTransform: 'uppercase',
              color: s.dim,
            }}
          >
            {s.collection} Collection
          </p>

          {/* Headline */}
          <h1
            className="text-center md:text-right mb-8"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(20px, 2.8vw, 36px)',
              fontWeight: 300,
              fontStyle: 'italic',
              letterSpacing: '0.015em',
              lineHeight: 1.4,
              color: s.white,
              whiteSpace: 'pre-line',
              textShadow: '0 2px 18px rgba(0,0,0,0.4)',
            }}
          >
            {s.headline}
          </h1>

          {/* CTA button */}
          <div className="flex justify-center md:justify-end">
            <Link
              href={s.href}
              className="inline-block transition-all duration-300"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                fontWeight: 300,
                letterSpacing: '0.38em',
                padding: '13px 38px',
                border: `1px solid ${s.gold}70`,
                color: s.gold,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.background = s.gold
                el.style.color = '#0f2418'
                el.style.borderColor = s.gold
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'transparent'
                el.style.color = s.gold
                el.style.borderColor = `${s.gold}70`
              }}
            >
              {s.cta.toUpperCase()}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Loading indicator ── */}
      {!allLoaded && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      )}

      {/* ── Dot nav ── */}
      {allLoaded && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
              className="focus:outline-none transition-all duration-300"
              style={{
                width: i === current ? '26px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: i === current ? '#c9a84c' : 'rgba(255,255,255,0.4)',
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}
