"use client";

import Link from "next/link";

type CategoryPaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  buildHref?: (page: number) => string;
};

export function CategoryPagination({
  page,
  totalPages,
  onPageChange,
  buildHref,
}: CategoryPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visible =
    totalPages <= 7
      ? pages
      : pages.filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);

  const getHref = (p: number) => (buildHref ? buildHref(p) : `?page=${p}`);

  return (
    <nav className="plp-pagination" aria-label="Product pages">
      {page <= 1 ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="Go to previous page (disabled)"
        >
          Previous
        </button>
      ) : (
        <Link
          href={getHref(page - 1)}
          className="plp-pagination__link"
          aria-label="Go to previous page"
          onClick={(e) => {
            if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
              e.preventDefault();
              onPageChange(page - 1);
            }
          }}
        >
          Previous
        </Link>
      )}

      <div className="plp-pagination__pages">
        {visible.map((p, i) => {
          const prev = visible[i - 1];
          const showEllipsis = prev !== undefined && p - prev > 1;
          const isActive = p === page;

          return (
            <span key={p} className="plp-pagination__item">
              {showEllipsis && <span className="plp-pagination__ellipsis" aria-hidden="true">…</span>}
              <Link
                href={getHref(p)}
                className={`plp-pagination__link ${isActive ? "is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                aria-label={isActive ? `Page ${p}, current page` : `Go to page ${p}`}
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    onPageChange(p);
                  }
                }}
              >
                {p}
              </Link>
            </span>
          );
        })}
      </div>

      {page >= totalPages ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="Go to next page (disabled)"
        >
          Next
        </button>
      ) : (
        <Link
          href={getHref(page + 1)}
          className="plp-pagination__link"
          aria-label="Go to next page"
          onClick={(e) => {
            if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
              e.preventDefault();
              onPageChange(page + 1);
            }
          }}
        >
          Next
        </Link>
      )}
    </nav>
  );
}

