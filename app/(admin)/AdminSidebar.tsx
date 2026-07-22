'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Products', href: '/admin/products' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Content', href: '/admin/content' },
]

function isActive(pathname: string, href: string) {
  if (href === '/admin/dashboard') {
    return pathname === '/admin/dashboard' || pathname === '/admin'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Lock body scroll when drawer open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const nav = (
    <nav className="admin-shell__nav" aria-label="Admin">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? 'admin-shell__link is-active' : 'admin-shell__link'}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Mobile top bar */}
      <header className="admin-shell__topbar">
        <button
          type="button"
          className="admin-shell__menu-btn"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={open ? 'admin-shell__burger is-open' : 'admin-shell__burger'} />
        </button>
        <Link href="/admin/dashboard" className="admin-shell__topbar-brand">
          <img src="/images/vairius_logo.png" alt="VAIRIS" />
        </Link>
        <Link href="/" className="admin-shell__topbar-store">
          Store
        </Link>
      </header>

      {/* Backdrop */}
      {open && (
        <button
          type="button"
          className="admin-shell__backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar / drawer */}
      <aside className={open ? 'admin-shell__sidebar is-open' : 'admin-shell__sidebar'}>
        <div className="admin-shell__brand">
          <Link href="/">
            <img src="/images/vairius_logo.png" alt="VAIRIS" />
          </Link>
        </div>
        {nav}
        <div className="admin-shell__footer">
          <Link href="/" className="admin-shell__storefront">
            ← Storefront
          </Link>
        </div>
      </aside>
    </>
  )
}
