"use client";

import { useEffect } from "react";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import {
  CategoryFilterPanel,
  countActiveFilters,
  defaultFilterState,
  type CategoryFilterPanelProps,
} from "./CategoryFilterPanel";
import type { FilterState } from "./CategoryFilterPanel";

type MobileFilterDrawerProps = {
  open: boolean;
  onClose: () => void;
  draftFilters: FilterState;
  onDraftChange: (next: FilterState) => void;
  onApply: () => void;
  groups: CategoryFilterPanelProps["groups"];
  productCount: number;
  focusSort?: boolean;
  hasPricedProducts?: boolean;
};

export function MobileFilterDrawer({
  open,
  onClose,
  draftFilters,
  onDraftChange,
  onApply,
  groups,
  productCount,
  focusSort,
  hasPricedProducts,
}: MobileFilterDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    if (focusSort) {
      document.getElementById("plp-mobile-filter-sort")?.scrollIntoView({ block: "start" });
    }
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, focusSort]);

  if (!open) return null;

  const activeCount = countActiveFilters(draftFilters);

  const clearAll = () => {
    onDraftChange({ ...defaultFilterState(), sort: draftFilters.sort });
  };

  const handleApply = () => {
    onApply();
    onClose();
  };

  return (
    <div className="mobile-filter-drawer" role="dialog" aria-modal="true" aria-label="Filters">
      <div className="mobile-filter-drawer__backdrop" onClick={onClose} aria-hidden />
      <div className="mobile-filter-drawer__sheet">
        <div className="mobile-filter-drawer__head">
          <h2>Filters</h2>
          <button type="button" onClick={onClose} aria-label="Close filters">
            <ThemeIcon name="close_modal" category="navigation" size={22} />
          </button>
        </div>

        <div className="mobile-filter-drawer__body">
          <CategoryFilterPanel
            filters={draftFilters}
            onChange={onDraftChange}
            groups={groups}
            sortSectionId="plp-mobile-filter-sort"
            showCount
            productCount={productCount}
            hasPricedProducts={hasPricedProducts}
          />
        </div>

        <div className="mobile-filter-drawer__footer">
          <button type="button" className="btn btn-secondary" onClick={clearAll} disabled={activeCount === 0}>
            Clear All
          </button>
          <button type="button" className="btn btn-primary" onClick={handleApply}>
            Apply{activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
