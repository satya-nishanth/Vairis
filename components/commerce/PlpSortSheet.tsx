"use client";

import { useRef } from "react";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { useSheetA11y } from "@/components/commerce/useSheetA11y";
import { SORT_OPTIONS, type SortKey } from "@/lib/plp-facets";

type Props = {
  open: boolean;
  onClose: () => void;
  sort: SortKey;
  onSelect: (sort: SortKey) => void;
  /** Hide the price sorts when no product shows a price. */
  hasPricedProducts: boolean;
};

/** Mobile sort sheet: one tap applies and closes. */
export function PlpSortSheet(props: Props) {
  return props.open ? <Sheet {...props} /> : null;
}

function Sheet({ onClose, sort, onSelect, hasPricedProducts }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useSheetA11y(true, ref, onClose);
  const options = SORT_OPTIONS.filter((o) => hasPricedProducts || !o.key.startsWith("price"));

  return (
    <div className="plp-sheet" role="dialog" aria-modal="true" aria-label="Sort by" ref={ref}>
      <div className="plp-sheet__backdrop" onClick={onClose} aria-hidden />
      <div className="plp-sheet__panel">
        <span className="plp-sheet__grab" aria-hidden />
        <div className="plp-sheet__head">
          <h2>Sort by</h2>
          <button type="button" className="plp-sheet__close" onClick={onClose} aria-label="Close sort">
            <ThemeIcon name="close_modal" category="navigation" size={22} />
          </button>
        </div>
        <div className="plp-sheet__body" role="radiogroup" aria-label="Sort by">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={sort === o.key}
              className={`plp-sort-option${sort === o.key ? " is-on" : ""}`}
              onClick={() => {
                onSelect(o.key);
                onClose();
              }}
            >
              <span className="plp-sort-option__text">
                <span>{o.label}</span>
                {o.hint && <span className="plp-sort-option__hint">{o.hint}</span>}
              </span>
              <span className="plp-sort-option__radio" aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
