import type { Product } from "@/lib/ui-data";

/** Pure filter / sort / facet-count logic for the category listing page. */

export type SortKey = "recommended" | "best" | "new" | "price-asc" | "price-desc";

export const SORT_OPTIONS: { key: SortKey; label: string; hint?: string }[] = [
  { key: "recommended", label: "Recommended", hint: "Bestsellers and new designs first" },
  { key: "best", label: "Bestsellers" },
  { key: "new", label: "New arrivals" },
  { key: "price-asc", label: "Price: low to high", hint: "Price on request designs shown last" },
  { key: "price-desc", label: "Price: high to low", hint: "Price on request designs shown last" },
];

export type PriceBucketId = "u15" | "15-25" | "25-50" | "50p" | "request";

/** Edges in ₹, applied to the displayed "From" price after any automatic discount. */
export const PRICE_BUCKETS: { id: PriceBucketId; label: string; min: number; max: number }[] = [
  { id: "u15", label: "Under ₹15k", min: 0, max: 15_000 },
  { id: "15-25", label: "₹15k–25k", min: 15_000, max: 25_000 },
  { id: "25-50", label: "₹25k–50k", min: 25_000, max: 50_000 },
  { id: "50p", label: "₹50k+", min: 50_000, max: Infinity },
  { id: "request", label: "Price on request", min: 0, max: 0 },
];

export type PlpFilters = {
  types: string[];
  occasions: string[];
  prices: PriceBucketId[];
  shapes: string[];
  ready: boolean;
  sort: SortKey;
  worn: boolean;
};

export const DEFAULT_FILTERS: PlpFilters = {
  types: [],
  occasions: [],
  prices: [],
  shapes: [],
  ready: false,
  sort: "recommended",
  worn: false,
};

export type FilterGroup = "types" | "occasions" | "prices" | "shapes";

export function displayedPrice(p: Product): number | null {
  if (p.price == null) return null;
  const pct = p.autoDiscountPercent && p.autoDiscountPercent > 0 ? Math.round(p.autoDiscountPercent) : 0;
  return pct > 0 ? Math.max(0, Math.round(p.price * (1 - pct / 100))) : p.price;
}

export function priceBucketOf(p: Product): PriceBucketId {
  const price = displayedPrice(p);
  if (price == null) return "request";
  return PRICE_BUCKETS.find((b) => b.id !== "request" && price >= b.min && price < b.max)!.id;
}

const matches: Record<FilterGroup, (p: Product, selected: string[]) => boolean> = {
  types: (p, sel) => sel.some((v) => p.types?.includes(v)),
  occasions: (p, sel) => sel.some((v) => p.occasions?.includes(v)),
  prices: (p, sel) => sel.includes(priceBucketOf(p)),
  shapes: (p, sel) => !!p.shape && sel.includes(p.shape),
};

/** Within a group options are OR-ed; groups (and Ready to ship) are AND-ed. `skip` leaves one group out. */
export function filterProducts(products: Product[], f: PlpFilters, skip?: FilterGroup): Product[] {
  return products.filter(
    (p) =>
      (!f.ready || p.inStock) &&
      (Object.keys(matches) as FilterGroup[]).every((g) => g === skip || f[g].length === 0 || matches[g](p, f[g])),
  );
}

export type FacetCounts = Record<FilterGroup, Record<string, number>>;

/** Per-option counts, each computed with every OTHER group applied — a chip never leads to 0 results. */
export function facetCounts(products: Product[], f: PlpFilters): FacetCounts {
  const counts: FacetCounts = { types: {}, occasions: {}, prices: {}, shapes: {} };
  for (const p of filterProducts(products, f, "types")) for (const v of new Set(p.types ?? [])) bump(counts.types, v);
  for (const p of filterProducts(products, f, "occasions")) for (const v of new Set(p.occasions ?? [])) bump(counts.occasions, v);
  for (const p of filterProducts(products, f, "prices")) bump(counts.prices, priceBucketOf(p));
  for (const p of filterProducts(products, f, "shapes")) if (p.shape) bump(counts.shapes, p.shape);
  return counts;
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

/** Number of distinct stone shapes across the category (Shape filter shows at 2+). */
export function distinctShapes(products: Product[]): string[] {
  return Array.from(new Set(products.map((p) => p.shape).filter((s): s is string => !!s))).sort();
}

/** Sorted copy. `products` must arrive in Recommended order (stable tie-break). */
export function sortProducts(products: Product[], sort: SortKey): Product[] {
  const indexed = products.map((p, i) => ({ p, i }));
  const price = (p: Product) => displayedPrice(p);
  const by: Record<SortKey, (a: { p: Product; i: number }, b: { p: Product; i: number }) => number> = {
    recommended: () => 0,
    best: (a, b) => (b.p.salesRank ?? 0) - (a.p.salesRank ?? 0),
    new: (a, b) => Date.parse(b.p.createdAt ?? "") - Date.parse(a.p.createdAt ?? ""),
    "price-asc": (a, b) => (price(a.p) ?? Infinity) - (price(b.p) ?? Infinity),
    "price-desc": (a, b) => {
      const pa = price(a.p);
      const pb = price(b.p);
      if (pa == null || pb == null) return pa == null ? (pb == null ? 0 : 1) : -1; // on request last
      return pb - pa;
    },
  };
  return indexed
    .sort((a, b) => {
      const c = by[sort](a, b);
      return (Number.isNaN(c) ? 0 : c) || a.i - b.i;
    })
    .map(({ p }) => p);
}

export function activeFilterCount(f: PlpFilters): number {
  return f.types.length + f.occasions.length + f.prices.length + f.shapes.length + (f.ready ? 1 : 0);
}

// ── URL state ─────────────────────────────────────────────────────────────

type ParamReader = { get(key: string): string | null };

const list = (v: string | null) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Reads filters from the URL. Old links keep working: `style` values map onto
 * Type / Occasion, `sort=popular|newest`, `readyToShip=true`; `metal` is ignored.
 */
export function parseFilters(
  params: ParamReader | null,
  options: { types: string[]; occasions: string[] },
): PlpFilters {
  if (!params) return { ...DEFAULT_FILTERS };
  const legacyStyles = list(params.get("style"));
  const sortParam = params.get("sort");
  const sort: SortKey =
    sortParam === "newest" ? "new"
    : sortParam === "popular" ? "recommended"
    : SORT_OPTIONS.some((o) => o.key === sortParam) ? (sortParam as SortKey)
    : "recommended";
  const buckets = list(params.get("price")).filter((id): id is PriceBucketId =>
    PRICE_BUCKETS.some((b) => b.id === id),
  );
  return {
    types: [...list(params.get("type")), ...legacyStyles.filter((s) => !options.occasions.includes(s))],
    occasions: [...list(params.get("occasion")), ...legacyStyles.filter((s) => options.occasions.includes(s))],
    prices: buckets,
    shapes: list(params.get("shape")),
    ready: params.get("ready") === "1" || params.get("readyToShip") === "true",
    sort,
    worn: params.get("view") === "worn",
  };
}

/** Query string for the filters + page (without the leading "?"). Defaults are omitted. */
export function serializeFilters(f: PlpFilters, page = 1): string {
  const q = new URLSearchParams();
  if (f.types.length) q.set("type", f.types.join(","));
  if (f.occasions.length) q.set("occasion", f.occasions.join(","));
  if (f.prices.length) q.set("price", f.prices.join(","));
  if (f.shapes.length) q.set("shape", f.shapes.join(","));
  if (f.ready) q.set("ready", "1");
  if (f.sort !== "recommended") q.set("sort", f.sort);
  if (f.worn) q.set("view", "worn");
  if (page > 1) q.set("page", String(page));
  return q.toString();
}

// ── Pagination ────────────────────────────────────────────────────────────

/**
 * Page numbers to render, with "…" for skipped runs.
 * mobile: at most 6 number slots; desktop: first, last and current ±1.
 */
export function pageWindow(current: number, total: number, mode: "mobile" | "desktop"): (number | "…")[] {
  if (mode === "mobile") {
    if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, 4, "…", total];
    if (current >= total - 2) return [1, "…", total - 3, total - 2, total - 1, total];
    return [1, "…", current, "…", total];
  }
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = Array.from(new Set([1, current - 1, current, current + 1, total]))
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  pages.forEach((p, i) => {
    const prev = pages[i - 1];
    if (prev !== undefined && p - prev === 2) out.push(prev + 1);
    else if (prev !== undefined && p - prev > 2) out.push("…");
    out.push(p);
  });
  return out;
}
