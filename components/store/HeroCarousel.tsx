'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { HeroSlide } from '@/lib/hero-images'

const DEFAULT_SLIDES = [
  {
    id: 'default-1',
    src: '/images/website-assets/hero-1.jpeg',
    alt: 'Model wearing VAIRIS earrings',
    collection: 'Earrings',
    headline: 'Where heritage meets\nthe extraordinary.',
    href: '/shop/earrings',
    cta: 'Discover Earrings',
    textColor: '#c9a84c',
    headlineColor: 'rgba(255,255,255,0.92)',
    subColor: 'rgba(201,168,76,0.72)',
  },
  {
    id: 'default-2',
    src: '/images/website-assets/hero-2.jpeg',
    alt: 'VAIRIS bracelet lifestyle',
    collection: 'Bracelets',
    headline: 'Crafted with precision.\nWorn with pride.',
    href: '/shop/bracelets',
    cta: 'Shop Bracelets',
    textColor: '#ffffff',
    headlineColor: 'rgba(255,255,255,0.92)',
    subColor: 'rgba(255,255,255,0.65)',
  },
  {
    id: 'default-3',
    src: '/images/website-assets/hero-3.jpeg',
    alt: 'VAIRIS pendant gifting moment',
    collection: 'Pendants',
    headline: 'Fine jewellery,\nreimagined.',
    href: '/shop/pendants',
    cta: 'Explore Pendants',
    textColor: '#ffffff',
    headlineColor: 'rgba(255,255,255,0.92)',
    subColor: 'rgba(255,255,255,0.65)',
  },
]

const OVERLAY_MOBILE = 'linear-gradient(to top, rgba(8,22,14,0.65) 0%, rgba(8,22,14,0.30) 50%, rgba(8,22,14,0.05) 100%)'
const OVERLAY_DESKTOP = 'linear-gradient(to left, rgba(8,22,14,0.90) 0%, rgba(8,22,14,0.68) 42%, rgba(8,22,14,0.10) 100%)'
const OVERLAY_DB = 'linear-gradient(to top, rgba(8,22,14,0.35) 0%, rgba(8,22,14,0.08) 60%, transparent 100%)'

type Props = {
  dbSlides?: HeroSlide[]
}

export default function HeroCarousel({ dbSlides = [] }: Props) {
  const useDbSlides = dbSlides.length > 0
  const slideCount = useDbSlides ? dbSlides.length : DEFAULT_SLIDES.length

  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(0)
  const [allLoaded, setAllLoaded] = useState(false)
  const loadedCount = useRef(0)
  const touchStartX = useRef(0)

  const handleImageLoad = useCallback(() => {
    loadedCount.current += 1
    if (loadedCount.current >= slideCount) setAllLoaded(true)
  }, [slideCount])

  const goTo = useCallback((idx: number) => {
    setCurrent(idx)
    setTimeout(() => setVisible(idx), 50)
  }, [])

  useEffect(() => {
    loadedCount.current = 0
    setAllLoaded(false)
    setCurrent(0)
    setVisible(0)
  }, [useDbSlides, dbSlides.map((s) => s.id).join(',')])

  useEffect(() => {
    if (!allLoaded || slideCount <= 1) return
    const t = setInterval(() => goTo((current + 1) % slideCount), 5500)
    return () => clearInterval(t)
  }, [allLoaded, current, goTo, slideCount])

  const s = useDbSlides ? null : DEFAULT_SLIDES[current]
  const shown = visible === current

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) < 50) return
    goTo(diff > 0 ? (current + 1) % slideCount : (current - 1 + slideCount) % slideCount)
  }

  const textContent = (align: 'center' | 'right') => {
    if (!s) return null
    return (
      <div
        style={{
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}
      >
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '9px',
          fontWeight: 400,
          letterSpacing: '0.38em',
          textTransform: 'uppercase',
          color: align === 'center' ? s.subColor.replace(/[\d.]+\)$/, '0.55)') : s.subColor,
          marginBottom: '8px',
          textAlign: align,
        }}>
          {s.collection} Collection
        </p>

        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: align === 'center' ? 'clamp(26px, 7.5vw, 42px)' : 'clamp(32px, 4.5vw, 58px)',
          fontWeight: 300,
          letterSpacing: '0.22em',
          lineHeight: 1,
          color: align === 'center'
            ? s.textColor + (s.textColor === '#ffffff' ? 'cc' : 'bb')
            : s.textColor,
          textShadow: '0 1px 12px rgba(0,0,0,0.35)',
          marginBottom: '10px',
          textAlign: align,
        }}>
          VAIRIS
        </p>

        <div style={{
          width: align === 'center' ? '44px' : '60px',
          height: '1px',
          margin: align === 'center' ? '0 auto 10px' : '0 0 14px auto',
          background: `linear-gradient(${align === 'center' ? 'to right' : 'to left'}, transparent, ${s.textColor}45, ${s.textColor}80)`,
        }} />

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: align === 'center' ? 'clamp(13px, 3.8vw, 22px)' : 'clamp(17px, 2.2vw, 30px)',
          fontWeight: 300,
          fontStyle: 'italic',
          letterSpacing: '0.01em',
          lineHeight: 1.5,
          color: align === 'center'
            ? s.headlineColor.replace(/[\d.]+\)$/, '0.70)')
            : s.headlineColor,
          whiteSpace: 'pre-line',
          textShadow: '0 1px 10px rgba(0,0,0,0.3)',
          marginBottom: '18px',
          textAlign: align,
        }}>
          {s.headline}
        </h1>

        <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-end' }}>
          <Link
            href={s.href}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '10px',
              fontWeight: 300,
              letterSpacing: '0.35em',
              padding: align === 'center' ? '9px 24px' : '12px 32px',
              border: `1px solid ${s.textColor}${align === 'center' ? '45' : '65'}`,
              color: align === 'center'
                ? s.textColor + (s.textColor === '#ffffff' ? 'cc' : 'bb')
                : s.textColor,
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
    )
  }

  return (
    <section
      className="hero-carousel relative w-full overflow-hidden"
      style={{ height: 'min(90vh, 720px)' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {useDbSlides ? (
        dbSlides.map((slide, i) => (
          <div
            key={slide.id}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: i === visible ? 1 : 0 }}
          >
            <Image
              src={slide.url}
              alt={`VAIRIS hero banner ${i + 1}`}
              fill
              priority={i === 0}
              sizes="100vw"
              quality={82}
              className="object-cover object-center"
              onLoad={handleImageLoad}
            />
          </div>
        ))
      ) : (
        DEFAULT_SLIDES.map((slide, i) => (
          <div
            key={slide.id}
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
              className={`object-cover hero-slide-${i}`}
              style={{ objectPosition: i === 0 ? '30% center' : 'center' }}
              onLoad={handleImageLoad}
            />
          </div>
        ))
      )}

      {useDbSlides ? (
        <div className="absolute inset-0" style={{ background: OVERLAY_DB }} />
      ) : (
        <>
          <div className="absolute inset-0 md:hidden" style={{ background: OVERLAY_MOBILE }} />
          <div className="absolute inset-0 hidden md:block" style={{ background: OVERLAY_DESKTOP }} />
        </>
      )}

      {!useDbSlides && (
        <>
          <div className="md:hidden absolute bottom-16 left-0 right-0 px-6">
            {textContent('center')}
          </div>
          <div
            className="hidden md:block absolute"
            style={{
              right: '5%',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 'min(400px, 42vw)',
            }}
          >
            {textContent('right')}
          </div>
        </>
      )}

      {!allLoaded && (
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex gap-2">
          {Array.from({ length: slideCount }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      )}

      {allLoaded && slideCount > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2.5">
          {Array.from({ length: slideCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
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
