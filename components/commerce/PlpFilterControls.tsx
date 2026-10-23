"use client";

import { useState } from "react";
import {
  PRICE_BUCKETS,
  type FacetCounts,
  type FilterGroup,
  type PlpFilters,
  type PriceBucketId,
} from "@/lib/plp-facets";

export type PlpFilterOptions = {
  types: string[];
  occasions: string[];
  shapes: string[];
  /** at least one product is in stock */
  canFilterReady: boolean;
};

type Props = {
  filters: PlpFilters;
  onChange: (next: PlpFilters) => void;
  options: PlpFilterOptions;
  counts: FacetCounts;
  /** sheet: chips for Price / Occasion / Shape. sidebar: checkboxes throughout. */
  variant: "sheet" | "sidebar";
};

const TYPE_LIMIT = 3;

function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Options with 0 products are hidden, unless the shopper already picked them. */
function visible<T extends string>(all: T[], counts: Record<string, number>, selected: T[]): T[] {
  return all.filter((v) => (counts[v] ?? 0) > 0 || selected.includes(v));
}

export function PlpFilterControls({ filters, onChange, options, counts, variant }: Props) {
  const [showAllTypes, setShowAllTypes] = useState(false);
  const chips = variant === "sheet";

  const prices = visible(PRICE_BUCKETS.map((b) => b.id), counts.prices, filters.prices);
  const types = visible(options.types, counts.types, filters.types);
  const occasions = visible(options.occasions, counts.occasions, filters.occasions);
  const shapes = visible(options.shapes, counts.shapes, filters.shapes);
  const typeList = showAllTypes ? types : types.filter((t, i) => i < TYPE_LIMIT || filters.types.includes(t));

  const labelOf = (id: PriceBucketId) => PRICE_BUCKETS.find((b) => b.id === id)!.label;

  const set = (group: FilterGroup, value: string) =>
    onChange({ ...filters, [group]: toggle(filters[group] as string[], value) } as PlpFilters);

  const chipGroup = (group: FilterGroup, values: string[], label: (v: string) => string) => (
    <div className="plp-filter__chips">
      {values.map((v) => {
        const on = (filters[group] as string[]).includes(v);
        return (
          <button key={v} type="button" className={`plp-chip${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => set(group, v)}>
            {label(v)} <span className="plp-chip__n">({counts[group][v] ?? 0})</span>
          </button>
        );
      })}
    </div>
  );

  const checkGroup = (group: FilterGroup, values: string[], label: (v: string) => string) => (
    <ul className="plp-filter__list">
      {values.map((v) => (
        <li key={v}>
          <label className="plp-filter__check">
            <input type="checkbox" checked={(filters[group] as string[]).includes(v)} onChange={() => set(group, v)} />
            <span>{label(v)}</span>
            <span className="plp-filter__n">{counts[group][v] ?? 0}</span>
          </label>
        </li>
      ))}
    </ul>
  );

  const render = chips ? chipGroup : checkGroup;
  const same = (v: string) => v;

  return (
    <>
      {prices.length > 0 && (
        <section className="plp-filter__group" aria-labelledby={`plp-f-price-${variant}`}>
          <h3 id={`plp-f-price-${variant}`}>Price</h3>
          {render("prices", prices, (v) => labelOf(v as PriceBucketId))}
        </section>
      )}

      {types.length > 0 && (
        <section className="plp-filter__group" aria-labelledby={`plp-f-type-${variant}`}>
          <h3 id={`plp-f-type-${variant}`}>Type</h3>
          {checkGroup("types", typeList, same)}
          {types.length > typeList.length && (
            <button type="button" className="plp-filter__more" onClick={() => setShowAllTypes(true)}>
              Show all types
            </button>
          )}
        </section>
      )}

      {occasions.length > 0 && (
        <section className="plp-filter__group" aria-labelledby={`plp-f-occ-${variant}`}>
          <h3 id={`plp-f-occ-${variant}`}>Occasion</h3>
          {render("occasions", occasions, same)}
        </section>
      )}

      {shapes.length > 0 && options.shapes.length >= 2 && (
        <section className="plp-filter__group" aria-labelledby={`plp-f-shape-${variant}`}>
          <h3 id={`plp-f-shape-${variant}`}>Shape</h3>
          {render("shapes", shapes, same)}
        </section>
      )}

      {options.canFilterReady && (
        <section className="plp-filter__group">
          <label className="plp-filter__check">
            <input type="checkbox" checked={filters.ready} onChange={(e) => onChange({ ...filters, ready: e.target.checked })} />
            <span>Ready to ship</span>
          </label>
        </section>
      )}
    </>
  );
}
