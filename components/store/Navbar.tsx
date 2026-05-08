'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const CATEGORIES = [
  { label: 'Rings', href: '/shop/rings' },
  { label: 'Earrings', href: '/shop/earrings' },
  { label: 'Pendants', href: '/shop/pendants' },
  { label: 'Bracelets', href: '/shop/bracelets' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  return (
    <header className="bg-brand-dark sticky top-0 z-50 shadow-lg">
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-2xl tracking-[0.25em] text-brand-gold hover:text-brand-gold/80 transition-colors"
        >
          VAIRIS
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              className="text-xs text-white/70 hover:text-brand-gold transition-colors tracking-[0.15em] uppercase"
            >
              {cat.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/shop"
            className="text-xs text-white/50 hover:text-brand-gold transition-colors tracking-widest uppercase hidden md:block"
          >
            All
          </Link>

          {/* Wishlist heart */}
          <Link
            href="/wishlist"
            aria-label="Wishlist"
            className="text-white/50 hover:text-brand-gold transition-colors relative"
          >
            <svg
              className="w-5 h-5"
              fill={isLoggedIn ? 'none' : 'none'}
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
              />
            </svg>
          </Link>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setOpen((o) => !o)}
            className="md:hidden flex items-center justify-center w-8 h-8 text-white/70 hover:text-brand-gold transition-colors"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? (
              <span className="text-xl leading-none">✕</span>
            ) : (
              <span className="text-xl leading-none">☰</span>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden bg-brand-dark border-t border-white/10">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              onClick={() => setOpen(false)}
              className="block px-6 py-3.5 text-xs text-white/70 hover:text-brand-gold hover:bg-white/5 transition-colors tracking-[0.15em] uppercase border-b border-white/5 last:border-0"
            >
              {cat.label}
            </Link>
          ))}
          <Link
            href="/wishlist"
            onClick={() => setOpen(false)}
            className="block px-6 py-3.5 text-xs text-white/70 hover:text-brand-gold hover:bg-white/5 transition-colors tracking-[0.15em] uppercase"
          >
            Wishlist ♡
          </Link>
        </div>
      )}
    </header>
  )
}
