"use client";

import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { SORT_OPTIONS, type SortKey } from "@/lib/plp-facets";

type Props = {
  activeFilters: number;
  sort: SortKey;
  onHand: boolean;
  /** Hide the On hand switch when no product has a worn photo. */
  canShowOnHand: boolean;
  /** plural noun, e.g. "rings" */
  noun: string;
  onOpenFilters: () => void;
  onOpenSort: () => void;
  onToggleOnHand: () => void;
};

/** Sticky bottom bar on phones: Filter · Sort · On hand. */
export function PlpMobileBar({ activeFilters, sort, onHand, canShowOnHand, noun, onOpenFilters, onOpenSort, onToggleOnHand }: Props) {
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "Recommended";

  return (
    <div className="mobile-filter-bar" role="toolbar" aria-label="Filter, sort and view" data-cells={canShowOnHand ? 3 : 2}>
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
      {canShowOnHand && (
        <button
          type="button"
          role="switch"
          aria-checked={onHand}
          aria-label={`Show ${noun} on hand`}
          className={`mobile-filter-bar__btn${onHand ? " is-on" : ""}`}
          onClick={onToggleOnHand}
        >
          <span className="mobile-filter-bar__stack">
            <span className="mobile-filter-bar__title">On hand</span>
            <span className="mobile-filter-bar__sub">{onHand ? "On" : "Off"}</span>
          </span>
        </button>
      )}
    </div>
  );
}
