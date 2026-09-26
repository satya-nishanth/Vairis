"use client";

export type SortOption = "popular" | "newest" | "price-asc" | "price-desc";

export type FilterState = {
  sort: SortOption;
  styles: string[];
  metals: string[];
  readyToShip: boolean;
};

type FilterGroup = {
  id: keyof Pick<FilterState, "styles" | "metals">;
  title: string;
  options: string[];
};

export type CategoryFilterPanelProps = {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  groups: FilterGroup[];
  sortSectionId?: string;
  showCount?: boolean;
  productCount?: number;
  hasPricedProducts?: boolean;
};

export function CategoryFilterPanel({
  filters,
  onChange,
  groups,
  sortSectionId = "plp-filter-sort",
  showCount = false,
  productCount,
  hasPricedProducts = true,
}: CategoryFilterPanelProps) {
  const toggle = (group: FilterGroup, value: string) => {
    const current = filters[group.id];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange({ ...filters, [group.id]: next });
  };

  return (
    <>
      <div className="plp-filters__group" id={sortSectionId}>
        <h3>Sort By</h3>
        <select
          value={filters.sort}
          onChange={(e) => onChange({ ...filters, sort: e.target.value as SortOption })}
          aria-label="Sort products"
        >
          <option value="popular">Popular</option>
          <option value="newest">Newest</option>
          {hasPricedProducts && (
            <>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </>
          )}
        </select>
      </div>

      {groups.map((group) => (
        <div key={group.id} className="plp-filters__group">
          <h3>{group.title}</h3>
          <ul className="plp-filters__list">
            {group.options.map((option) => (
              <li key={option}>
                <label className="plp-filters__check">
                  <input
                    type="checkbox"
                    checked={filters[group.id].includes(option)}
                    onChange={() => toggle(group, option)}
                  />
                  <span>{option}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="plp-filters__group">
        <h3>Availability</h3>
        <label className="plp-filters__check">
          <input
            type="checkbox"
            checked={filters.readyToShip}
            onChange={(e) => onChange({ ...filters, readyToShip: e.target.checked })}
          />
          <span>Ready to Ship</span>
        </label>
      </div>

      {showCount && productCount != null && (
        <p className="plp-filters__count">{productCount} products</p>
      )}
    </>
  );
}

export function countActiveFilters(filters: FilterState): number {
  return filters.styles.length + filters.metals.length + (filters.readyToShip ? 1 : 0);
}

export function defaultFilterState(): FilterState {
  return {
    sort: "popular",
    styles: [],
    metals: [],
    readyToShip: false,
  };
}
