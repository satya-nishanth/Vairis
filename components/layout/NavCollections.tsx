"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";

type NavCollection = { slug: string; title: string };

let cache: NavCollection[] | null = null;

/** Admin-pinned collections in the header nav with compact dropdown to fit desktop screens */
export function NavCollections() {
  const [items, setItems] = useState<NavCollection[]>(cache ?? []);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false
    fetch('/api/nav-collections', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: NavCollection[]) => {
        if (cancelled || !Array.isArray(rows)) return
        cache = rows
        setItems(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`nav-collections-dropdown${isOpen ? " is-open" : ""}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
    >
      <Link
        href="/collections"
        className="nav-collections-trigger"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontSize: "var(--header-nav-font, 0.75rem)",
          fontWeight: 600,
          color: "var(--header-nav-text)",
          whiteSpace: "nowrap",
          textDecoration: "none",
        }}
      >
        Collections
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </Link>

      {isOpen && (
        <div
          className="nav-collections-menu"
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--color-surface, #ffffff)",
            border: "1px solid var(--color-border-light, #e5e7eb)",
            borderRadius: "8px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            padding: "8px 0",
            minWidth: "200px",
            zIndex: 100,
          }}
        >
          {items.map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              style={{
                display: "block",
                padding: "8px 16px",
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--color-text, #111827)",
                textDecoration: "none",
                textTransform: "none",
                letterSpacing: "normal",
                transition: "background 0.15s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-hover, #f3f4f6)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {c.title}
            </Link>
          ))}
          <div style={{ borderTop: "1px solid var(--color-border-light, #f3f4f6)", margin: "4px 0" }} />
          <Link
            href="/collections"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            style={{
              display: "block",
              padding: "8px 16px",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--color-primary, #b45309)",
              textDecoration: "none",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-hover, #f3f4f6)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            All Collections →
          </Link>
        </div>
      )}
    </div>
  );
}
