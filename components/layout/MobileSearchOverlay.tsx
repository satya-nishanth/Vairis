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

export function MobileSearchOverlay({ open, onClose }: MobileSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  // Debounced live search — all state updates happen inside the timeout so
  // the effect body itself never sets state synchronously.
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="search-input"
          />
          <button type="button" className="mobile-search__close" onClick={onClose} aria-label="Close search">
            <ThemeIcon name="close_modal" category="navigation" size={22} />
          </button>
        </div>

        {loading && <p className="mobile-search__hint">Searching…</p>}

        {searched && results.length === 0 && !loading && (
          <p className="mobile-search__hint" data-testid="search-empty">
            No pieces match &ldquo;{query.trim()}&rdquo; — try a different word or browse below.
          </p>
        )}

        {results.length > 0 && (
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
