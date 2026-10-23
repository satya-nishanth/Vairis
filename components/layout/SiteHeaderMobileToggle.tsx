"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { HeaderPincode } from "./HeaderPincode";
import { categoryHref } from "@/lib/catalogue-ui";

type NavLink = { href: string; label: string };
type DynamicNavCategory = { slug: string; name: string };
type DynamicNavCollection = { slug: string; title: string };

function MenuIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="site-header__menu-lines" viewBox="0 0 24 24" width="24" height="24" aria-hidden>
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className="site-header__menu-lines" viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

type SiteHeaderMobileToggleProps = {
  links: NavLink[];
  showPincode?: boolean;
  showTheme?: boolean;
};

export function SiteHeaderMobileToggle({ links, showPincode, showTheme }: SiteHeaderMobileToggleProps) {
  const [open, setOpen] = useState(false);
  const [dynamicCats, setDynamicCats] = useState<DynamicNavCategory[]>([]);
  const [dynamicCols, setDynamicCols] = useState<DynamicNavCollection[]>([]);

  useEffect(() => {
    fetch("/api/nav-categories")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DynamicNavCategory[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setDynamicCats(data);
        }
      })
      .catch(() => {});

    fetch("/api/nav-collections", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DynamicNavCollection[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setDynamicCols(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="site-header__menu-btn"
        aria-expanded={open}
        aria-controls="site-header-mobile-drawer"
        onClick={() => setOpen((v) => !v)}
      >
        <MenuIcon open={open} />
        <span className="visually-hidden">{open ? "Close menu" : "Open menu"}</span>
      </button>

      {open && (
        <>
          <div className="site-header__drawer-backdrop" onClick={() => setOpen(false)} aria-hidden />
          <nav id="site-header-mobile-drawer" className="site-header__drawer" aria-label="Mobile">
            <div className="site-header__drawer-head">
              <span className="site-header__drawer-title">Menu</span>
              <button type="button" className="site-header__drawer-close" onClick={() => setOpen(false)} aria-label="Close menu">
                <ThemeIcon name="close_modal" category="navigation" size={22} />
              </button>
            </div>

            {showPincode && (
              <div className="site-header__drawer-pincode">
                <HeaderPincode />
              </div>
            )}

            <div className="site-header__drawer-links">
              {dynamicCats.length > 0 ? (
                <>
                  {dynamicCats.map((c) => (
                    <Link key={c.slug} href={categoryHref(c.slug)} onClick={() => setOpen(false)}>
                      {c.name}
                    </Link>
                  ))}
                  <Link href="/about" onClick={() => setOpen(false)}>
                    About Us
                  </Link>
                </>
              ) : (
                links.map((link) => (
                  <Link key={`${link.href}-${link.label}`} href={link.href} onClick={() => setOpen(false)}>
                    {link.label}
                  </Link>
                ))
              )}
            </div>

            {dynamicCols.length > 0 && (
              <div className="site-header__drawer-section" style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', marginTop: '1rem' }}>
                <span className="site-header__drawer-section-title" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.75rem' }}>
                  Collections
                </span>
                <div className="site-header__drawer-links" style={{ gap: '0.625rem' }}>
                  {dynamicCols.map((c) => (
                    <Link key={c.slug} href={`/collections/${c.slug}`} onClick={() => setOpen(false)}>
                      {c.title}
                    </Link>
                  ))}
                  <Link href="/collections" onClick={() => setOpen(false)} style={{ color: 'var(--color-primary, #b45309)', fontWeight: 600 }}>
                    All Collections →
                  </Link>
                </div>
              </div>
            )}

            <div className="site-header__drawer-section" style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', marginTop: '1rem' }}>
              <span className="site-header__drawer-section-title" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.75rem' }}>
                Account &amp; Support
              </span>
              <div className="site-header__drawer-links" style={{ gap: '0.625rem' }}>
                <Link href="/account" onClick={() => setOpen(false)}>My Account</Link>
                <Link href="/account/orders" onClick={() => setOpen(false)}>My Orders</Link>
                <Link href="/wishlist" onClick={() => setOpen(false)}>Wishlist</Link>
                <Link href="/track-order" onClick={() => setOpen(false)}>Track Order</Link>
                <Link href="/contact" onClick={() => setOpen(false)}>Contact &amp; Concierge</Link>
                <Link href="/returns" onClick={() => setOpen(false)}>Returns &amp; Exchanges</Link>
              </div>
            </div>

            {showTheme && (
              <div className="site-header__drawer-theme">
                <span className="site-header__drawer-theme-label">Theme</span>
                <ThemeSwitcher />
              </div>
            )}
          </nav>
        </>
      )}
    </>
  );
}
