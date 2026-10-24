"use client";

import { PlpFilterControls, type PlpFilterOptions } from "@/components/commerce/PlpFilterControls";
import { activeFilterCount, facetCounts, type PlpFilters } from "@/lib/plp-facets";
import type { Product } from "@/lib/ui-data";

type Props = {
  filters: PlpFilters;
  onChange: (next: PlpFilters) => void;
  products: Product[];
  options: PlpFilterOptions;
};

/** Desktop filter column. Sticks under the header and scrolls on its own when taller than the window. */
export function PlpFilterSidebar({ filters, onChange, products, options }: Props) {
  const counts = facetCounts(products, filters);
  const active = activeFilterCount(filters);

  return (
    <aside className="plp-filters" aria-label="Filters">
      <div className="plp-filters__head">
        <h2>Filter</h2>
        {active > 0 && (
          <button
            type="button"
            className="plp-filters__clear"
            onClick={() => onChange({ ...filters, types: [], occasions: [], prices: [], shapes: [], ready: false })}
          >
            Clear all
          </button>
        )}
      </div>
      <PlpFilterControls filters={filters} onChange={onChange} options={options} counts={counts} variant="sidebar" />
    </aside>
  );
}
