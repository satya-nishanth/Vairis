import {
  DEFAULT_FILTERS,
  activeFilterCount,
  facetCounts,
  filterProducts,
  pageWindow,
  parseFilters,
  priceBucketOf,
  serializeFilters,
  sortProducts,
  type PlpFilters,
} from "@/lib/plp-facets";
import type { Product } from "@/lib/ui-data";

let n = 0;
const make = (over: Partial<Product>): Product => ({
  slug: `p${++n}`,
  sku: `sku${n}`,
  name: `Ring ${n}`,
  image: "",
  images: [],
  category: "rings",
  catalogueId: `p${n}`,
  types: [],
  occasions: [],
  ...over,
});

const products = [
  make({ name: "A", price: 9_000, types: ["Band"], occasions: ["Everyday"], inStock: true, createdAt: "2026-01-01" }),
  make({ name: "B", price: 20_000, types: ["Solitaire"], occasions: ["Gifting"], shape: "Round", createdAt: "2026-03-01", salesRank: 5 }),
  make({ name: "C", price: 60_000, types: ["Band", "Stackable"], shape: "Oval", createdAt: "2026-02-01", salesRank: 9 }),
  make({ name: "D", types: ["Solitaire"] }), // price on request
  make({ name: "E", price: 15_000, autoDiscountPercent: 10, types: ["Band"], createdAt: "2026-04-01" }), // shows ₹13,500
];
const f = (over: Partial<PlpFilters>): PlpFilters => ({ ...DEFAULT_FILTERS, ...over });
const names = (list: Product[]) => list.map((p) => p.name);

describe("price buckets", () => {
  it("uses the displayed price after the automatic discount", () => {
    expect(priceBucketOf(products[4])).toBe("u15"); // 15,000 − 10% = 13,500
    expect(priceBucketOf(products[0])).toBe("u15");
    expect(priceBucketOf(products[1])).toBe("15-25");
    expect(priceBucketOf(products[2])).toBe("50p");
    expect(priceBucketOf(products[3])).toBe("request");
    expect(priceBucketOf(make({ price: 25_000 }))).toBe("25-50"); // edge goes up
  });
});

describe("filterProducts", () => {
  it("ORs within a group and ANDs across groups", () => {
    expect(names(filterProducts(products, f({ types: ["Band"] })))).toEqual(["A", "C", "E"]);
    expect(names(filterProducts(products, f({ types: ["Band", "Solitaire"], prices: ["u15"] })))).toEqual(["A", "E"]);
    expect(names(filterProducts(products, f({ occasions: ["Gifting"], types: ["Band"] })))).toEqual([]);
  });

  it("filters by shape, price on request and ready to ship", () => {
    expect(names(filterProducts(products, f({ shapes: ["Oval"] })))).toEqual(["C"]);
    expect(names(filterProducts(products, f({ prices: ["request"] })))).toEqual(["D"]);
    expect(names(filterProducts(products, f({ ready: true })))).toEqual(["A"]);
  });
});

describe("facetCounts", () => {
  it("counts each group against the other groups, not itself", () => {
    const c = facetCounts(products, f({ types: ["Band"], prices: ["u15"] }));
    expect(c.types).toEqual({ Band: 2 }); // under ₹15k products only
    expect(c.prices).toEqual({ "u15": 2, "50p": 1 }); // Band products across price buckets
    expect(c.occasions).toEqual({ Everyday: 1 }); // within Band + under ₹15k
  });

  it("matches the result count of selecting an option", () => {
    const base = f({ types: ["Band"] });
    const counts = facetCounts(products, base);
    for (const bucket of Object.keys(counts.prices)) {
      expect(filterProducts(products, { ...base, prices: [bucket as never] })).toHaveLength(counts.prices[bucket]);
    }
  });
});

describe("sortProducts", () => {
  it("keeps Recommended order", () => {
    expect(names(sortProducts(products, "recommended"))).toEqual(["A", "B", "C", "D", "E"]);
  });
  it("sorts bestsellers by units, then recommended order", () => {
    expect(names(sortProducts(products, "best"))).toEqual(["C", "B", "A", "D", "E"]);
  });
  it("sorts new arrivals by date", () => {
    expect(names(sortProducts(products, "new")).slice(0, 4)).toEqual(["E", "B", "C", "A"]);
  });
  it("puts Price on request last in both price sorts", () => {
    expect(names(sortProducts(products, "price-asc"))).toEqual(["A", "E", "B", "C", "D"]);
    expect(names(sortProducts(products, "price-desc"))).toEqual(["C", "B", "E", "A", "D"]);
  });
});

describe("URL state", () => {
  const options = { types: ["Solitaire", "Band"], occasions: ["Gifting", "Office"] };
  const read = (qs: string) => parseFilters(new URLSearchParams(qs), options);

  it("round-trips filters and page", () => {
    const filters = f({ types: ["Band", "Solitaire"], occasions: ["Office"], prices: ["u15", "15-25"], shapes: ["Round"], ready: true, sort: "price-asc", worn: true });
    const qs = serializeFilters(filters, 3);
    expect(qs).toBe("type=Band%2CSolitaire&occasion=Office&price=u15%2C15-25&shape=Round&ready=1&sort=price-asc&view=worn&page=3");
    expect(read(qs)).toEqual(filters);
  });

  it("omits defaults", () => {
    expect(serializeFilters(DEFAULT_FILTERS)).toBe("");
    expect(read("")).toEqual(DEFAULT_FILTERS);
  });

  it("keeps old links working", () => {
    expect(read("style=Solitaire,Gifting&metal=Yellow+Gold&sort=newest&readyToShip=true")).toEqual(
      f({ types: ["Solitaire"], occasions: ["Gifting"], sort: "new", ready: true }),
    );
    expect(read("sort=popular").sort).toBe("recommended");
    expect(read("sort=bogus&price=zzz").prices).toEqual([]);
  });

  it("counts active filters", () => {
    expect(activeFilterCount(f({ types: ["a", "b"], ready: true, shapes: ["x"] }))).toBe(4);
    expect(activeFilterCount(f({ sort: "new", worn: true }))).toBe(0);
  });
});

describe("pageWindow", () => {
  const m = (c: number, t: number) => pageWindow(c, t, "mobile");
  const d = (c: number, t: number) => pageWindow(c, t, "desktop");

  it("shows every page when there are few", () => {
    expect(m(1, 4)).toEqual([1, 2, 3, 4]);
    expect(d(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("mobile uses at most 6 number slots, matching the design", () => {
    expect(m(1, 12)).toEqual([1, 2, 3, 4, "…", 12]);
    expect(m(3, 12)).toEqual([1, 2, 3, 4, "…", 12]);
    expect(m(6, 12)).toEqual([1, "…", 6, "…", 12]);
    expect(m(10, 12)).toEqual([1, "…", 9, 10, 11, 12]);
    expect(m(12, 12)).toEqual([1, "…", 9, 10, 11, 12]);
  });
  it("desktop shows current ±1", () => {
    expect(d(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]);
    expect(d(1, 12)).toEqual([1, 2, "…", 12]);
    expect(d(3, 12)).toEqual([1, 2, 3, 4, "…", 12]);
    expect(d(12, 12)).toEqual([1, "…", 11, 12]);
  });
});
