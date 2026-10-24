"use client";

import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { SORT_OPTIONS, type SortKey } from "@/lib/plp-facets";

type Props = {
  activeFilters: number;
  sort: SortKey;
  worn: boolean;
  /** Hide the Worn switch when no product has a worn photo. */
  canShowWorn: boolean;
  /** plural noun, e.g. "rings" */
  noun: string;
  onOpenFilters: () => void;
  onOpenSort: () => void;
  onToggleWorn: () => void;
};

/** Sticky bottom bar on phones: Filter · Sort · Worn. */
export function PlpMobileBar({ activeFilters, sort, worn, canShowWorn, noun, onOpenFilters, onOpenSort, onToggleWorn }: Props) {
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "Recommended";

  return (
    <div className="mobile-filter-bar" role="toolbar" aria-label="Filter, sort and view" data-cells={canShowWorn ? 3 : 2}>
      <button type="button" className="mobile-filter-bar__btn" onClick={onOpenFilters}>
        <ThemeIcon name="filter_sliders" category="navigation" size={18} />
        <span>Filter</span>
        {activeFilters > 0 && <span className="mobile-filter-bar__badge">{activeFilters}</span>}
      </button>
      <button type="button" className="mobile-filter-bar__btn" onClick={onOpenSort}>
        <span className="mobile-filter-bar__stack">
          <span className="mobile-filter-bar__title">Sort</span>
          <span className="mobile-filter-bar__sub">{sortLabel}</span>
        </span>
      </button>
      {canShowWorn && (
        <button
          type="button"
          role="switch"
          aria-checked={worn}
          aria-label={`Show ${noun} as worn`}
          className={`mobile-filter-bar__btn${worn ? " is-on" : ""}`}
          onClick={onToggleWorn}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7M4.5 20.5c1-4.2 4-6.5 7.5-6.5s6.5 2.3 7.5 6.5" />
          </svg>
          <span className="mobile-filter-bar__stack">
            <span className="mobile-filter-bar__title">Worn</span>
            <span className="mobile-filter-bar__sub">{worn ? "On" : "Off"}</span>
          </span>
        </button>
      )}
    </div>
  );
}
