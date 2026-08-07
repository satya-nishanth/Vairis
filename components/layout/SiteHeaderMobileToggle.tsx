"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { HeaderPincode } from "./HeaderPincode";

type NavLink = { href: string; label: string };

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
              {links.map((link) => (
                <Link key={`${link.href}-${link.label}`} href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              ))}
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
