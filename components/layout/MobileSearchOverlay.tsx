"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { ProductImage } from "@/components/ui/ProductImage";
import { CATEGORY_LABELS, categoryHref, HEADER_NAV_CATEGORIES } from "@/lib/catalogue-ui";

type MobileSearchOverlayProps = {
  open: boolean;
  onClose: () => void;
};

type SearchResult = {
  id: string;
  name: string;
  itemCode: string | null;
  category: string;
  image: string;
  price?: number;
};

const categoryLinks = HEADER_NAV_CATEGORIES.map((slug) => ({
  href: categoryHref(slug),
  label: CATEGORY_LABELS[slug].title,
}));

const POPULAR_SEARCHES = [
  "Solitaire",
  "Studs",
  "Diamond Rings",
  "Rose Gold",
  "Everyday Wear",
  "Minimal",
];

export function MobileSearchOverlay({ open, onClose }: MobileSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  // Debounced live search
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const t = setTimeout(
      async () => {
        if (q.length < 2) {
          setResults([]);
          setSearched(false);
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
          if (res.ok) {
            const data = (await res.json()) as { results: SearchResult[] };
            setResults(data.results);
            setSearched(true);
          }
        } catch {
          // network hiccup — keep previous results
        } finally {
          setLoading(false);
        }
      },
      q.length < 2 ? 0 : 250,
    );
    return () => clearTimeout(t);
  }, [query, open]);

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

  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setQuery("");
      setResults([]);
      setSearched(false);
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  const handleFullSearch = (qToSearch?: string) => {
    const term = (qToSearch ?? query).trim();
    if (!term) return;
    onClose();
    if (typeof window !== "undefined") {
      window.location.href = `/search?q=${encodeURIComponent(term)}`;
    }
  };

  if (!open) return null;

  return (
    <div className="mobile-search" role="dialog" aria-modal="true" aria-label="Search">
      <style>{`
        @media (min-width: 640px) {
          .mobile-search__panel {
            max-width: 580px !important;
            margin: 48px auto !important;
            border-radius: 12px !important;
            box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25) !important;
            border: 1px solid var(--color-border-light, #e5e7eb) !important;
          }
        }
      `}</style>
      <div className="mobile-search__backdrop" onClick={onClose} aria-hidden />
      <div className="mobile-search__panel">
        <form
          className="mobile-search__head"
          action="/search"
          method="GET"
          onSubmit={(e) => {
            e.preventDefault();
            handleFullSearch();
          }}
        >
          <input
            ref={inputRef}
            name="q"
            type="search"
            className="mobile-search__input"
            placeholder="Search jewellery..."
            aria-label="Search jewellery"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="search-input"
          />
          <button
            type="button"
            className="mobile-search__close"
            onClick={onClose}
            aria-label="Close search"
          >
            <ThemeIcon name="close_modal" category="navigation" size={22} />
          </button>
        </form>

        {/* Quick Suggestions when empty */}
        {!query.trim() && (
          <div style={{ marginTop: "14px", marginBottom: "16px" }}>
            <p className="mobile-search__hint" style={{ marginTop: 0, marginBottom: "8px" }}>
              Popular Searches
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {POPULAR_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setQuery(term);
                    inputRef.current?.focus();
                  }}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "16px",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    background: "var(--color-surface, #f3f4f6)",
                    color: "var(--color-text, #374151)",
                    border: "1px solid var(--color-border, #e5e7eb)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && <p className="mobile-search__hint">Searching…</p>}

        {searched && results.length === 0 && !loading && (
          <p className="mobile-search__hint" data-testid="search-empty">
            No pieces match &ldquo;{query.trim()}&rdquo; — try a different word or browse below.
          </p>
        )}

        {/* Results List */}
        {results.length > 0 && (
          <div style={{ marginTop: "8px", marginBottom: "16px" }}>
            <nav className="mobile-search__results" aria-label="Search results" data-testid="search-results">
              {results.map((r) => (
                <Link
                  key={r.id}
                  href={`/product/${r.id}`}
                  onClick={onClose}
                  className="mobile-search__result"
                >
                  <span className="mobile-search__result-thumb">
                    {r.image ? (
                      <ProductImage src={r.image} alt="" width={48} height={48} />
                    ) : (
                      <span aria-hidden>V</span>
                    )}
                  </span>
                  <span className="mobile-search__result-body">
                    <span className="mobile-search__result-name">{r.name}</span>
                    <span className="mobile-search__result-meta">
                      {r.itemCode ? `${r.itemCode} · ` : ""}
                      {r.category}
                      {r.price != null ? ` · ₹${r.price.toLocaleString("en-IN")}` : ""}
                    </span>
                  </span>
                </Link>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => handleFullSearch()}
              style={{
                width: "100%",
                padding: "9px 14px",
                borderRadius: "6px",
                background: "var(--color-surface, #f9fafb)",
                border: "1px solid var(--color-border, #e5e7eb)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--color-primary, #111827)",
                cursor: "pointer",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <span>View all results for &ldquo;{query.trim()}&rdquo;</span>
              <span>→</span>
            </button>
          </div>
        )}

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
