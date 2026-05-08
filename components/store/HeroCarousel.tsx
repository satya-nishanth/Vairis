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
    textColor: '#c9a84c',
    headlineColor: 'rgba(255,255,255,0.92)',
    subColor: 'rgba(201,168,76,0.7)',
  },
  {
    src: '/images/website-assets/hero-2.jpeg',
    alt: 'VAIRIS bracelet lifestyle',
    collection: 'Bracelets',
    headline: 'Crafted with precision.\nWorn with pride.',
    href: '/shop/bracelets',
    cta: 'Shop Bracelets',
    textColor: '#ffffff',
    headlineColor: 'rgba(255,255,255,0.92)',
    subColor: 'rgba(255,255,255,0.6)',
  },
  {
    src: '/images/website-assets/hero-3.jpeg',
    alt: 'VAIRIS pendant gifting moment',
    collection: 'Pendants',
    headline: 'Fine jewellery,\nreimagined.',
    href: '/shop/pendants',
    cta: 'Explore Pendants',
    textColor: '#ffffff',
    headlineColor: 'rgba(255,255,255,0.92)',
    subColor: 'rgba(255,255,255,0.6)',
  },
]

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
    <section
      className="relative w-full overflow-hidden"
      style={{ height: 'min(90vh, 720px)' }}
    >
      {/* All 3 images preloaded — opacity switch, no flicker */}
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
            className="object-cover"
            style={{ objectPosition: i === 0 ? '30% center' : 'center' }}
            onLoad={handleImageLoad}
          />
        </div>
      ))}

      {/* Dark overlay — darker on right for desktop text readability */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'linear-gradient(to left,  rgba(8,22,14,0.90) 0%, rgba(8,22,14,0.65) 45%, rgba(8,22,14,0.10) 100%)',
          ].join(''),
        }}
      />

      {/* Text block — absolute, right side, vertically centered, safe margins */}
      <div
        className="absolute"
        style={{
          right: '5%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 'min(400px, 42vw)',
          // Mobile: full width centred at bottom
        }}
      >
        {/* Mobile fallback: reposition to bottom-center */}
        <style>{`
          @media (max-width: 767px) {
            .hero-text-block {
              right: 0 !important;
              left: 0 !important;
              top: auto !important;
              bottom: 60px !important;
              transform: none !important;
              width: 100% !important;
              padding: 0 24px !important;
              text-align: center !important;
            }
          }
        `}</style>

        <div
          className="hero-text-block"
          style={{
            opacity: visible === current ? 1 : 0,
            transform: `translateY(${visible === current ? 0 : 14}px)`,
            transition: 'opacity 0.5s ease, transform 0.5s ease',
            textAlign: 'right',
          }}
        >
          {/* Collection label */}
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '10px',
            fontWeight: 400,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            color: s.subColor,
            marginBottom: '10px',
          }}>
            {s.collection} Collection
          </p>

          {/* VAIRIS — safe letter-spacing, safe size */}
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 4.5vw, 58px)',
            fontWeight: 300,
            letterSpacing: '0.22em',
            lineHeight: 1,
            color: s.textColor,
            textShadow: '0 2px 20px rgba(0,0,0,0.5)',
            marginBottom: '14px',
          }}>
            VAIRIS
          </p>

          {/* Divider — flush right */}
          <div style={{
            width: '60px',
            height: '1px',
            marginLeft: 'auto',
            background: `linear-gradient(to left, transparent, ${s.textColor}70, ${s.textColor})`,
            marginBottom: '14px',
          }} />

          {/* Headline */}
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(17px, 2.2vw, 30px)',
            fontWeight: 300,
            fontStyle: 'italic',
            letterSpacing: '0.01em',
            lineHeight: 1.45,
            color: s.headlineColor,
            whiteSpace: 'pre-line',
            textShadow: '0 2px 16px rgba(0,0,0,0.4)',
            marginBottom: '24px',
          }}>
            {s.headline}
          </h1>

          {/* CTA */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link
              href={s.href}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                fontWeight: 300,
                letterSpacing: '0.35em',
                padding: '12px 32px',
                border: `1px solid ${s.textColor}65`,
                color: s.textColor,
                display: 'inline-block',
                transition: 'background 0.25s, color 0.25s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.background = s.textColor
                el.style.color = '#0f2418'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'transparent'
                el.style.color = s.textColor
              }}
            >
              {s.cta.toUpperCase()}
            </Link>
          </div>
        </div>
      </div>

      {/* Loading dots */}
      {!allLoaded && (
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      )}

      {/* Dot nav */}
      {allLoaded && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2.5">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`}
              className="focus:outline-none transition-all duration-300"
              style={{
                width: i === current ? '24px' : '6px',
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
