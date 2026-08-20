'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin/finance', label: 'Dashboard', exact: true },
  { href: '/admin/finance/expenses', label: 'Expenses' },
  { href: '/admin/finance/orders', label: 'Order sheets' },
]

export function FinanceSubnav() {
  const pathname = usePathname()
  return (
    <nav style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: '0.875rem' }} aria-label="Finance">
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
        return (
          <Link
            key={l.href}
            href={l.href}
            style={{
              color: active ? '#111827' : '#6b7280',
              fontWeight: active ? 600 : 400,
              textDecoration: 'none',
              borderBottom: active ? '2px solid #032b24' : '2px solid transparent',
              paddingBottom: 4,
            }}
          >
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
