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
    vairisColor: '#c9a84c',
    // Dark green bg → gold logo visible as-is
    logoFilter: 'none',
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
    vairisColor: '#ffffff',
    // Cream bg → invert to white so logo is always visible
    logoFilter: 'brightness(0) invert(1)',
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
    vairisColor: '#ffffff',
    // Golden bokeh bg → invert to white
    logoFilter: 'brightness(0) invert(1)',
  },
]

const OVERLAY =
  'linear-gradient(to left, rgba(15,36,24,0.92) 0%, rgba(15,36,24,0.72) 38%, rgba(15,36,24,0.3) 62%, rgba(15,36,24,0.05) 100%)'

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
            className="object-cover object-left-top"
            onLoad={handleImageLoad}
          />
        </div>
      ))}

      {/* Dark-right overlay */}
      <div className="absolute inset-0" style={{ background: OVERLAY }} />

      {/* Text — RIGHT side */}
      <div className="absolute inset-0 flex items-center justify-end">
        <div
          className="px-8 md:px-16 lg:px-20 space-y-4 max-w-md xl:max-w-lg transition-all duration-500"
          style={{
            opacity: visible === current ? 1 : 0,
            transform: visible === current ? 'translateY(0)' : 'translateY(12px)',
            textAlign: 'right',
          }}
        >
          {/* Logo — CSS filter makes it visible on any background */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
            <img
              src="/images/vairius_logo.png"
              alt="VAIRIS"
              style={{
                height: '44px',
                width: 'auto',
                filter: slide.logoFilter,
                opacity: 0.92,
                transition: 'filter 0.5s',
              }}
            />
          </div>

          {/* VAIRIS — display text */}
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(36px, 5.5vw, 72px)',
              fontWeight: 300,
              letterSpacing: '0.45em',
              lineHeight: 1,
              color: slide.vairisColor,
              textShadow: '0 2px 24px rgba(0,0,0,0.5)',
              textAlign: 'right',
            }}
          >
            VAIRIS
          </p>

          {/* Thin divider flush right */}
          <div
            style={{
              width: '80px',
              height: '1px',
              marginLeft: 'auto',
              background: `linear-gradient(to left, transparent, ${slide.accentColor}88, ${slide.accentColor})`,
            }}
          />

          {/* Collection label */}
          <p
            style={{
              color: slide.subColor,
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: '11px',
              letterSpacing: '0.38em',
              textTransform: 'uppercase',
              textAlign: 'right',
            }}
          >
            {slide.sub}
          </p>

          {/* Headline */}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(18px, 2.8vw, 38px)',
              fontWeight: 300,
              fontStyle: 'italic',
              letterSpacing: '0.02em',
              whiteSpace: 'pre-line',
              color: '#ffffff',
              textShadow: '0 2px 20px rgba(0,0,0,0.4)',
              lineHeight: 1.35,
              textAlign: 'right',
            }}
          >
            {slide.headline}
          </h1>

          {/* CTA button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link
              href={slide.href}
              className="inline-block transition-all duration-300"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(11px, 1.4vw, 13px)',
                fontWeight: 300,
                letterSpacing: '0.4em',
                padding: '13px 36px',
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
