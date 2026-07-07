"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { CATEGORY_LABELS, categoryHref, HEADER_NAV_CATEGORIES } from "@/lib/catalogue-ui";

type MobileSearchOverlayProps = {
  open: boolean;
  onClose: () => void;
};

const categoryLinks = HEADER_NAV_CATEGORIES.map((slug) => ({
  href: categoryHref(slug),
  label: CATEGORY_LABELS[slug].title,
}));

export function MobileSearchOverlay({ open, onClose }: MobileSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mobile-search" role="dialog" aria-modal="true" aria-label="Search">
      <div className="mobile-search__backdrop" onClick={onClose} aria-hidden />
      <div className="mobile-search__panel">
        <div className="mobile-search__head">
          <input
            ref={inputRef}
            type="search"
            className="mobile-search__input"
            placeholder="Search jewellery..."
            aria-label="Search jewellery"
          />
          <button type="button" className="mobile-search__close" onClick={onClose} aria-label="Close search">
            <ThemeIcon name="close_modal" category="navigation" size={22} />
          </button>
        </div>
        <p className="mobile-search__hint">Browse by category</p>
        <nav className="mobile-search__categories" aria-label="Shop categories">
          {categoryLinks.map(({ href, label }) => (
            <Link key={href} href={href} onClick={onClose}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
