"use client";

type CategoryPaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function CategoryPagination({ page, totalPages, onPageChange }: CategoryPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visible =
    totalPages <= 7
      ? pages
      : pages.filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);

  return (
    <nav className="plp-pagination" aria-label="Product pages">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </button>
      <div className="plp-pagination__pages">
        {visible.map((p, i) => {
          const prev = visible[i - 1];
          const showEllipsis = prev !== undefined && p - prev > 1;
          return (
            <span key={p} className="plp-pagination__item">
              {showEllipsis && <span className="plp-pagination__ellipsis">…</span>}
              <button type="button" className={p === page ? "is-active" : ""} onClick={() => onPageChange(p)}>
                {p}
              </button>
            </span>
          );
        })}
      </div>
      <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}
