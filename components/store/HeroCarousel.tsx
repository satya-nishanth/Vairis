'use client'
import { useState, useEffect, useCallback } from 'react'
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
    // Model on left — text anchored right
    textAlign: 'right' as const,
  },
  {
    src: '/images/website-assets/hero-2.jpeg',
    alt: 'VAIRIS bracelet lifestyle',
    headline: 'Crafted with precision.\nWorn with pride.',
    sub: 'Bracelets Collection',
    href: '/shop/bracelets',
    cta: 'Shop Bracelets',
    textAlign: 'center' as const,
  },
  {
    src: '/images/website-assets/hero-3.jpeg',
    alt: 'VAIRIS pendant gifting moment',
    headline: 'Fine jewellery,\nreimagined.',
    sub: 'Pendants Collection',
    href: '/shop/pendants',
    cta: 'Explore Pendants',
    textAlign: 'center' as const,
  },
]

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0)
  const [transitioning, setTransitioning] = useState(false)

  const goTo = useCallback((idx: number) => {
    if (transitioning) return
    setTransitioning(true)
    setTimeout(() => {
      setCurrent(idx)
      setTransitioning(false)
    }, 400)
  }, [transitioning])

  useEffect(() => {
    const timer = setInterval(() => {
      goTo((current + 1) % SLIDES.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [current, goTo])

  const slide = SLIDES[current]

  return (
    <section className="relative w-full overflow-hidden" style={{ height: 'min(90vh, 720px)' }}>
      {/* Background image */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: transitioning ? 0 : 1 }}
      >
        <Image
          src={slide.src}
          alt={slide.alt}
          fill
          priority={current === 0}
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Gradient overlay — darker on the text side */}
      <div
        className="absolute inset-0"
        style={{
          background: slide.textAlign === 'right'
            ? 'linear-gradient(to left, rgba(15,36,24,0.85) 0%, rgba(15,36,24,0.55) 50%, rgba(15,36,24,0.1) 100%)'
            : 'linear-gradient(to top, rgba(15,36,24,0.80) 0%, rgba(15,36,24,0.45) 50%, rgba(15,36,24,0.15) 100%)',
        }}
      />

      {/* Text content */}
      <div
        className={`absolute inset-0 flex items-center ${
          slide.textAlign === 'right' ? 'justify-end' : 'justify-center'
        }`}
      >
        <div
          className={`px-8 md:px-16 space-y-5 max-w-lg transition-all duration-700 ${
            transitioning ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'
          } ${slide.textAlign === 'center' ? 'text-center' : 'text-right'}`}
        >
          <p
            className="text-brand-gold/70 tracking-[0.4em] text-xs uppercase"
          >
            {slide.sub}
          </p>
          <h1
            className="font-display text-white leading-tight"
            style={{
              fontSize: 'clamp(28px, 4.5vw, 56px)',
              fontWeight: 300,
              letterSpacing: '0.02em',
              whiteSpace: 'pre-line',
            }}
          >
            {slide.headline}
          </h1>
          <div
            className={`h-px w-24 bg-gradient-to-r from-brand-gold/30 via-brand-gold/60 to-brand-gold/30 ${
              slide.textAlign === 'center' ? 'mx-auto' : 'ml-auto'
            }`}
          />
          <Link
            href={slide.href}
            className="inline-block font-display border border-brand-gold/60 text-brand-gold hover:bg-brand-gold hover:text-brand-dark transition-all duration-300"
            style={{
              padding: '14px 40px',
              fontSize: 'clamp(11px, 1.5vw, 13px)',
              letterSpacing: '0.4em',
              fontWeight: 300,
            }}
          >
            {slide.cta.toUpperCase()}
          </Link>
        </div>
      </div>

      {/* Dot navigation */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="transition-all duration-300"
            style={{
              width: i === current ? '28px' : '6px',
              height: '6px',
              borderRadius: i === current ? '3px' : '50%',
              background: i === current ? '#c9a84c' : 'rgba(201,168,76,0.35)',
            }}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Slide counter */}
      <div className="absolute bottom-6 right-8 font-display text-white/30 text-xs tracking-widest">
        {String(current + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
      </div>
    </section>
  )
}
