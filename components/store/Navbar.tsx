'use client'
import { useState } from 'react'
import Link from 'next/link'

const CATEGORIES = [
  { label: 'Rings', href: '/shop/rings' },
  { label: 'Earrings', href: '/shop/earrings' },
  { label: 'Pendants', href: '/shop/pendants' },
  { label: 'Bracelets', href: '/shop/bracelets' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

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
            className="text-xs text-white/50 hover:text-brand-gold transition-colors tracking-widest uppercase"
          >
            All
          </Link>

          {/* Hamburger button — mobile only */}
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
        </div>
      )}
    </header>
  )
}
