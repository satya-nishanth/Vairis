'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin/inventory', label: 'Stock', exact: true },
  { href: '/admin/inventory/holders', label: 'Holders' },
  { href: '/admin/inventory/activity', label: 'Activity' },
]

export function InventorySubnav() {
  const pathname = usePathname()
  return (
    <nav
      style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: '0.875rem', flexWrap: 'wrap' }}
      aria-label="Inventory"
    >
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
