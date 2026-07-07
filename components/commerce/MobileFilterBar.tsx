"use client";

import { ThemeIcon } from "@/components/icons/ThemeIcon";
import type { FilterState } from "./CategoryFilterPanel";
import { countActiveFilters } from "./CategoryFilterPanel";

const SORT_LABELS: Record<FilterState["sort"], string> = {
  popular: "Popular",
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
};

type MobileFilterBarProps = {
  filters: FilterState;
  onOpenFilters: () => void;
  onOpenSort: () => void;
};

export function MobileFilterBar({ filters, onOpenFilters, onOpenSort }: MobileFilterBarProps) {
  const activeCount = countActiveFilters(filters);

  return (
    <div className="mobile-filter-bar" role="toolbar" aria-label="Filter and sort products">
      <button type="button" className="mobile-filter-bar__btn" onClick={onOpenFilters}>
        <ThemeIcon name="filter_sliders" category="navigation" size={18} />
        <span>Filters</span>
        {activeCount > 0 && <span className="mobile-filter-bar__badge">{activeCount}</span>}
      </button>
      <button type="button" className="mobile-filter-bar__btn" onClick={onOpenSort}>
        <span className="mobile-filter-bar__sort-label">Sort: {SORT_LABELS[filters.sort]}</span>
      </button>
    </div>
  );
}
