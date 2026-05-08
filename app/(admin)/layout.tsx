import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'

const NAV = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Products', href: '/admin/products' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Mobile top bar */}
      <div className="flex md:hidden items-center justify-between h-14 bg-brand-dark px-4 shadow-md">
        <Link href="/" className="flex items-center">
          <img src="/images/vairius_logo.png" alt="VAIRIS" style={{ height: '28px', width: 'auto' }} />
        </Link>
        <div className="flex items-center gap-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs text-white/70 hover:text-brand-gold transition-colors tracking-wide uppercase"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-brand-dark flex-shrink-0 flex-col">
        <Link href="/" className="h-16 flex items-center justify-center px-6 border-b border-white/10">
          <img src="/images/vairius_logo.png" alt="VAIRIS" style={{ height: '32px', width: 'auto' }} />
        </Link>
        <nav className="flex-1 py-6 space-y-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center px-3 py-2.5 rounded text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors tracking-wide"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-white/10">
          <p className="text-xs text-white/30">Admin Panel</p>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
