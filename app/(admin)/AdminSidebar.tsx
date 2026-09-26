'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface AdminSidebarProps {
  showFinance?: boolean
  userEmail?: string
}

const NAV: { label: string; href: string; financeOnly?: boolean }[] = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Users & Roles', href: '/admin/users' },
  { label: 'Customers', href: '/admin/customers' },
  { label: 'Analytics', href: '/admin/analytics' },
  { label: 'Products', href: '/admin/products' },
  { label: 'Categories', href: '/admin/categories' },
  { label: 'Inventory', href: '/admin/inventory' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Finance', href: '/admin/finance', financeOnly: true },
  { label: 'Invoices', href: '/admin/invoices' },
  { label: 'Content', href: '/admin/content' },
  { label: 'Collections', href: '/admin/collections' },
  { label: 'Home Sections', href: '/admin/sections' },
  { label: 'Pricing', href: '/admin/settings/pricing' },
  { label: 'Cost Estimator', href: '/admin/cost-estimator' },
  { label: 'Promos', href: '/admin/promos' },
  { label: 'Reviews', href: '/admin/reviews' },
  { label: 'Contacts', href: '/admin/contacts' },
]

function isActive(pathname: string, href: string) {
  if (href === '/admin/dashboard') {
    return pathname === '/admin/dashboard' || pathname === '/admin'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminSidebar({
  showFinance = false,
  userEmail = '',
}: AdminSidebarProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleLogout() {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      await fetch('/api/auth/signout', { method: 'POST' }).catch(() => {})
    } catch (err) {
      console.error('Error during logout:', err)
    } finally {
      window.location.href = '/auth/admin'
    }
  }

  // Close drawer on route change
  useEffect(() => {
// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync reset, pre-compiler pattern
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
      {NAV.filter((item) => !item.financeOnly || showFinance).map((item) => {
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
          aria-controls="admin-shell-drawer"
          onClick={() => setOpen((v) => !v)}
        >
          <span className={open ? 'admin-shell__burger is-open' : 'admin-shell__burger'} />
        </button>
        <Link href="/admin/dashboard" className="admin-shell__topbar-brand">
          <img src="/images/vairius_logo.png" alt="VAIRIS" />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link href="/" className="admin-shell__topbar-store">
            Store
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="admin-shell__topbar-logout"
            aria-label="Log out"
            title="Log out"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
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
      <aside
        id="admin-shell-drawer"
        className={open ? 'admin-shell__sidebar is-open' : 'admin-shell__sidebar'}
      >
        <div className="admin-shell__brand">
          <Link href="/">
            <img src="/images/vairius_logo.png" alt="VAIRIS" />
          </Link>
        </div>
        {nav}
        <div className="admin-shell__footer">
          {userEmail && (
            <div className="admin-shell__user-info">
              <div className="admin-shell__user-avatar">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <div className="admin-shell__user-details">
                <span className="admin-shell__user-email" title={userEmail}>
                  {userEmail}
                </span>
                <span className="admin-shell__user-role">
                  {showFinance ? 'Finance Admin' : 'Store Admin'}
                </span>
              </div>
            </div>
          )}
          <div className="admin-shell__footer-actions">
            <Link href="/" className="admin-shell__storefront">
              ← Storefront
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="admin-shell__logout-btn"
              title="Sign out of Admin Dashboard"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {isLoggingOut ? 'Logging out...' : 'Log out'}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
