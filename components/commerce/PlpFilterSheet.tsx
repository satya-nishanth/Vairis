"use client";

import { useRef, useState } from "react";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { PlpFilterControls, type PlpFilterOptions } from "@/components/commerce/PlpFilterControls";
import { useSheetA11y } from "@/components/commerce/useSheetA11y";
import { activeFilterCount, facetCounts, filterProducts, type PlpFilters } from "@/lib/plp-facets";
import type { Product } from "@/lib/ui-data";

type Props = {
  open: boolean;
  onClose: () => void;
  filters: PlpFilters;
  onApply: (next: PlpFilters) => void;
  products: Product[];
  options: PlpFilterOptions;
  /** plural noun for the button, e.g. "rings" */
  noun: string;
};

/** Mobile filter sheet. Edits a draft; "Show N rings" applies it and closes. */
export function PlpFilterSheet(props: Props) {
  // Remount on open so the draft starts from the applied filters.
  return props.open ? <Sheet {...props} /> : null;
}

function Sheet({ onClose, filters, onApply, products, options, noun }: Props) {
  const [draft, setDraft] = useState(filters);
  const ref = useRef<HTMLDivElement>(null);
  useSheetA11y(true, ref, onClose);

  const count = filterProducts(products, draft).length;
  const counts = facetCounts(products, draft);
  const clearAll = () => setDraft({ ...draft, types: [], occasions: [], prices: [], shapes: [], ready: false });

  return (
    <div className="plp-sheet" role="dialog" aria-modal="true" aria-label="Filter" ref={ref}>
      <div className="plp-sheet__backdrop" onClick={onClose} aria-hidden />
      <div className="plp-sheet__panel">
        <span className="plp-sheet__grab" aria-hidden />
        <div className="plp-sheet__head">
          <h2>Filter</h2>
          <div className="plp-sheet__head-actions">
            <button type="button" className="plp-sheet__clear" onClick={clearAll} disabled={activeFilterCount(draft) === 0}>
              Clear all
            </button>
            <button type="button" className="plp-sheet__close" onClick={onClose} aria-label="Close filter">
              <ThemeIcon name="close_modal" category="navigation" size={22} />
            </button>
          </div>
        </div>
        <div className="plp-sheet__body">
          <PlpFilterControls filters={draft} onChange={setDraft} options={options} counts={counts} variant="sheet" />
        </div>
        <div className="plp-sheet__footer">
          <button
            type="button"
            className="btn btn-primary plp-sheet__apply"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {count === 0 ? `No ${noun} match` : `Show ${count} ${count === 1 ? noun.replace(/s$/, "") : noun}`}
          </button>
        </div>
      </div>
    </div>
  );
}
