"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { NAV_PANELS, RINGS_LINKS } from "@/lib/nav-menu-content";
import { BrandLogo } from "./BrandLogo";
import { MobileSearchOverlay } from "./MobileSearchOverlay";
import { NavIcon } from "./NavIcons";
import { useNavData } from "./nav-data";

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

/** Mobile menu: hamburger button and the slide-in drawer. */
export function SiteHeaderMobileToggle() {
  // Open belongs to the page it was opened on, so navigating closes the drawer.
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const setOpen = (next: boolean | ((v: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(open) : next;
    setOpenPath(value ? pathname : null);
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const { categories, collections } = useNavData();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPath(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hasRings = categories.some((c) => c.slug === "rings");
  const others = categories.filter((c) => c.slug !== "rings");
  const collectionLinks = [
    ...(collections.length > 0 ? collections : NAV_PANELS.collections.links),
    { label: "All collections", href: "/collections" },
  ];
  const close = () => setOpen(false);

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
          <div className="site-header__drawer-backdrop" onClick={close} aria-hidden />
          <div id="site-header-mobile-drawer" className="nav-drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="nav-drawer__head">
              <Link href="/" onClick={close} aria-label="VAIRIS home">
                <BrandLogo className="nav-drawer__logo" />
              </Link>
              <button type="button" className="nav-drawer__close" onClick={close} aria-label="Close menu">
                <NavIcon name="close" size={22} />
              </button>
            </div>

            <div className="nav-drawer__intro">
              <p className="nav-eyebrow">EVERYDAY DIAMOND WEAR</p>
              <h2>
                Find a little
                <br />
                brilliance.
              </h2>
            </div>

            <button
              type="button"
              className="nav-drawer__search"
              onClick={() => {
                setOpen(false);
                setSearchOpen(true);
              }}
            >
              <NavIcon name="search" size={16} />
              Search jewellery
              <NavIcon name="arrow" size={16} />
            </button>

            <nav aria-label="Mobile navigation" className="nav-drawer__nav">
              {hasRings && (
                <details open>
                  <summary>
                    Rings<span aria-hidden="true" />
                  </summary>
                  <div className="nav-drawer__sub">
                    {RINGS_LINKS.map((l, i) => (
                      <Link key={l.href} href={l.href} onClick={close}>
                        {l.label}
                        {i === 0 && <NavIcon name="arrow" size={16} />}
                      </Link>
                    ))}
                  </div>
                </details>
              )}
              {others.map((c) => (
                <Link key={c.slug} href={c.href} onClick={close}>
                  {c.name}
                  <NavIcon name="arrow" size={17} />
                </Link>
              ))}
              <details>
                <summary>
                  Collections<span aria-hidden="true" />
                </summary>
                <div className="nav-drawer__sub">
                  {collectionLinks.map((l) => (
                    <Link key={l.href} href={l.href} onClick={close}>
                      {l.label}
                    </Link>
                  ))}
                </div>
              </details>
            </nav>

            <Link href="/dna-diamond" className="nav-drawer__dna" onClick={close}>
              <NavIcon name="diamond" size={22} />
              <span>
                <b>DNA Diamond</b>
                <small>A diamond with your story.</small>
              </span>
              <NavIcon name="arrow" size={17} />
            </Link>

            <div className="nav-drawer__footer">
              <Link href="/about" onClick={close}>
                Our story
              </Link>
              <Link href="/our-services" onClick={close}>
                Our promises
              </Link>
              <Link href="/contact" onClick={close}>
                Need help?
              </Link>
            </div>

            <div className="nav-drawer__bottom">
              <Link href="/account" onClick={close}>
                <NavIcon name="user" size={15} />
                My account
              </Link>
              <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                Switch theme
              </button>
            </div>
          </div>
        </>
      )}

      <MobileSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
