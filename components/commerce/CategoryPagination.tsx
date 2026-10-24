"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { pageWindow } from "@/lib/plp-facets";

const PHONE = "(max-width: 767px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia?.(PHONE);
  mq?.addEventListener("change", cb);
  return () => mq?.removeEventListener("change", cb);
};
const isPhone = () => window.matchMedia?.(PHONE).matches ?? false;

type CategoryPaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  buildHref?: (page: number) => string;
};

/**
 * Round page buttons. Phones show up to 6 number slots (so it fits 360px),
 * desktop shows the first, last and current ±1.
 */
export function CategoryPagination({ page, totalPages, onPageChange, buildHref }: CategoryPaginationProps) {
  const phone = useSyncExternalStore(subscribe, isPhone, () => false);
  if (totalPages <= 1) return null;

  const getHref = (p: number) => (buildHref ? buildHref(p) : `?page=${p}`);
  const plain = (e: React.MouseEvent) => !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  const go = (p: number) => (e: React.MouseEvent) => {
    if (plain(e)) {
      e.preventDefault();
      onPageChange(p);
    }
  };

  const arrow = (dir: "prev" | "next") => {
    const target = dir === "prev" ? page - 1 : page + 1;
    const disabled = dir === "prev" ? page <= 1 : page >= totalPages;
    const label = dir === "prev" ? "previous" : "next";
    const glyph = dir === "prev" ? "‹" : "›";
    const text = dir === "prev" ? "Previous" : "Next";
    return disabled ? (
      <button type="button" disabled aria-disabled="true" className="plp-pagination__arrow" aria-label={`Go to ${label} page (disabled)`}>
        <span aria-hidden="true" className="plp-pagination__glyph">{glyph}</span>
        <span className="plp-pagination__text">{text}</span>
      </button>
    ) : (
      <Link href={getHref(target)} className="plp-pagination__link plp-pagination__arrow" aria-label={`Go to ${label} page`} onClick={go(target)}>
        <span aria-hidden="true" className="plp-pagination__glyph">{glyph}</span>
        <span className="plp-pagination__text">{text}</span>
      </Link>
    );
  };

  const numbers = (
    <ol className="plp-pagination__pages">
      {pageWindow(page, totalPages, phone ? "mobile" : "desktop").map((p, i) =>
        p === "…" ? (
          <li key={`gap-${i}`} className="plp-pagination__ellipsis" aria-hidden="true">…</li>
        ) : (
          <li key={p}>
            <Link
              href={getHref(p)}
              className={`plp-pagination__link${p === page ? " is-active" : ""}`}
              aria-current={p === page ? "page" : undefined}
              aria-label={p === page ? `Page ${p}, current page` : `Go to page ${p}`}
              onClick={go(p)}
            >
              {p}
            </Link>
          </li>
        ),
      )}
    </ol>
  );

  return (
    <nav className="plp-pagination" aria-label="Product pages">
      {arrow("prev")}
      {numbers}
      {arrow("next")}
    </nav>
  );
}
