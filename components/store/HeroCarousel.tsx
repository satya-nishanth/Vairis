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
    accentColor: '#c9a84c',
    subColor: 'rgba(201,168,76,0.8)',
  },
  {
    src: '/images/website-assets/hero-2.jpeg',
    alt: 'VAIRIS bracelet lifestyle',
    headline: 'Crafted with precision.\nWorn with pride.',
    sub: 'Bracelets Collection',
    href: '/shop/bracelets',
    cta: 'Shop Bracelets',
    accentColor: '#ffffff',
    subColor: 'rgba(255,255,255,0.7)',
  },
  {
    src: '/images/website-assets/hero-3.jpeg',
    alt: 'VAIRIS pendant gifting moment',
    headline: 'Fine jewellery,\nreimagined.',
    sub: 'Pendants Collection',
    href: '/shop/pendants',
    cta: 'Explore Pendants',
    accentColor: '#ffffff',
    subColor: 'rgba(255,255,255,0.7)',
  },
]

// Full-cover dark overlay — centred layout needs even coverage
const OVERLAY =
  'linear-gradient(to top, rgba(15,36,24,0.85) 0%, rgba(15,36,24,0.55) 45%, rgba(15,36,24,0.25) 100%)'

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
      {/* All 3 images always in DOM — opacity switch, no flicker */}
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
            priority
            sizes="100vw"
            quality={80}
            className="object-cover object-center"
            onLoad={handleImageLoad}
          />
        </div>
      ))}

      {/* Dark overlay — bottom-heavy so centred text floats over any image */}
      <div className="absolute inset-0" style={{ background: OVERLAY }} />

      {/* Text — centred */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div
          className="flex flex-col items-center text-center space-y-4 max-w-2xl transition-all duration-500"
          style={{
            opacity: visible === current ? 1 : 0,
            transform: visible === current ? 'translateY(0)' : 'translateY(14px)',
          }}
        >
          {/* Logo image — bigger */}
          <img
            src="/images/vairius_logo.png"
            alt="VAIRIS"
            style={{ height: '64px', width: 'auto', opacity: 0.95 }}
            className="drop-shadow-[0_2px_16px_rgba(201,168,76,0.25)]"
          />

          {/* VAIRIS display text */}
          <p
            className="text-white"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(36px, 7vw, 88px)',
              fontWeight: 300,
              letterSpacing: '0.45em',
              lineHeight: 1,
              textShadow: '0 2px 24px rgba(0,0,0,0.5)',
            }}
          >
            VAIRIS
          </p>

          {/* Thin divider */}
          <div
            className="mx-auto"
            style={{
              width: 'min(160px, 40vw)',
              height: '1px',
              background: `linear-gradient(90deg, transparent, ${slide.accentColor}66 20%, ${slide.accentColor}cc, ${slide.accentColor}66 80%, transparent)`,
            }}
          />

          {/* Collection label */}
          <p
            className="tracking-[0.4em] text-xs uppercase"
            style={{ color: slide.subColor, fontFamily: 'var(--font-body)', fontWeight: 400 }}
          >
            {slide.sub}
          </p>

          {/* Headline */}
          <h1
            className="text-white leading-snug"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(20px, 3.2vw, 42px)',
              fontWeight: 300,
              letterSpacing: '0.02em',
              fontStyle: 'italic',
              whiteSpace: 'pre-line',
              textShadow: '0 2px 20px rgba(0,0,0,0.4)',
            }}
          >
            {slide.headline}
          </h1>

          {/* CTA */}
          <Link
            href={slide.href}
            className="inline-block mt-2 transition-all duration-300"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(11px, 1.4vw, 13px)',
              fontWeight: 300,
              letterSpacing: '0.4em',
              padding: '14px 42px',
              border: `1px solid ${slide.accentColor}80`,
              color: slide.accentColor,
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background = slide.accentColor
              el.style.color = '#0f2418'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'transparent'
              el.style.color = slide.accentColor
            }}
          >
            {slide.cta.toUpperCase()}
          </Link>
        </div>
      </div>

      {/* Loading dots */}
      {!allLoaded && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      )}

      {/* Dot navigation */}
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
                background: i === current ? '#c9a84c' : 'rgba(255,255,255,0.35)',
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
