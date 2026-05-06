import Link from 'next/link'

const CATEGORIES = [
  { label: 'Rings', href: '/shop/rings' },
  { label: 'Earrings', href: '/shop/earrings' },
  { label: 'Pendants', href: '/shop/pendants' },
  { label: 'Bracelets', href: '/shop/bracelets' },
]

export default function Navbar() {
  return (
    <header className="bg-brand-dark sticky top-0 z-50 shadow-lg">
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-2xl tracking-[0.25em] text-brand-gold hover:text-brand-gold/80 transition-colors"
        >
          VAIRIS
        </Link>

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
        </div>
      </nav>
    </header>
  )
}
