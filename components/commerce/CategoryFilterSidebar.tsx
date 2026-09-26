"use client";

import { CategoryFilterPanel, countActiveFilters } from "./CategoryFilterPanel";
import type { FilterState } from "./CategoryFilterPanel";

type FilterGroup = {
  id: keyof Pick<FilterState, "styles" | "metals">;
  title: string;
  options: string[];
};

type CategoryFilterSidebarProps = {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  productCount: number;
  groups: FilterGroup[];
  hasPricedProducts?: boolean;
};

export type { FilterState, SortOption } from "./CategoryFilterPanel";

export function CategoryFilterSidebar({
  filters,
  onChange,
  productCount,
  groups,
  hasPricedProducts,
}: CategoryFilterSidebarProps) {
  const activeCount = countActiveFilters(filters);

  const clearAll = () => {
    onChange({
      sort: filters.sort,
      styles: [],
      metals: [],
      readyToShip: false,
    });
  };

  return (
    <aside className="plp-filters" aria-label="Product filters">
      <div className="plp-filters__head">
        <h2>Filters</h2>
        {activeCount > 0 && (
          <button type="button" className="plp-filters__clear" onClick={clearAll}>
            Clear ({activeCount})
          </button>
        )}
      </div>

      <CategoryFilterPanel
        filters={filters}
        onChange={onChange}
        groups={groups}
        showCount
        productCount={productCount}
        hasPricedProducts={hasPricedProducts}
      />
    </aside>
  );
}
