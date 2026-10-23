/**
 * @jest-environment node
 */
import {
  getDefaultFilterConfig,
  getAllCategoryFilters,
  getCategoryFilters,
  saveCategoryFilters,
  resetCategoryFilters,
  productLabelsFromTags,
  setProductLabels,
} from "@/lib/category-filters";

// In-memory stand-in for the DB tables, so "a fresh process" is just re-reading from it.
type ConfigRow = { categorySlug: string; categoryName: string | null; types: string[]; occasions: string[]; updatedAt: Date };
type TagRow = { productId: string; group: string; value: string };
const db: { configs: ConfigRow[]; tags: TagRow[] } = { configs: [], tags: [] };
const products = [
  { id: "ring_1", category: "RINGS" },
  { id: "ring_2", category: "RINGS" },
  { id: "earring_1", category: "EARRINGS" },
];

jest.mock("@/lib/store-categories", () => ({ getStoreCategories: jest.fn().mockResolvedValue([]) }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    categoryFilterConfig: {
      findMany: jest.fn(async () => db.configs),
      findUnique: jest.fn(async ({ where }) => db.configs.find((c) => c.categorySlug === where.categorySlug) ?? null),
      upsert: jest.fn(async ({ where, create, update }) => {
        const existing = db.configs.find((c) => c.categorySlug === where.categorySlug);
        if (existing) return Object.assign(existing, update, { updatedAt: new Date() });
        const row = { categoryName: null, ...create, updatedAt: new Date() };
        db.configs.push(row);
        return row;
      }),
    },
    product: {
      findMany: jest.fn(async ({ where }) => products.filter((p) => p.category === where.category)),
    },
    productTag: {
      findMany: jest.fn(async () =>
        db.tags.map((t) => ({ ...t, product: { category: products.find((p) => p.id === t.productId)!.category } })),
      ),
      deleteMany: jest.fn(({ where }) => {
        const ids: string[] | undefined = where.productId?.in;
        db.tags = db.tags.filter(
          (t) =>
            !((ids ? ids.includes(t.productId) : t.productId === where.productId) && where.value.in.includes(t.value)),
        );
        return Promise.resolve();
      }),
      createMany: jest.fn(({ data }) => {
        for (const d of data) {
          if (!db.tags.some((t) => t.productId === d.productId && t.group === d.group && t.value === d.value)) db.tags.push(d);
        }
        return Promise.resolve();
      }),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

beforeEach(() => {
  db.configs = [];
  db.tags = [];
});

describe("Category filters (DB-backed)", () => {
  it("returns built-in defaults for a category with no stored row", async () => {
    const config = getDefaultFilterConfig("rings");
    expect(config.types).toContain("Solitaire");
    expect(config.occasions).toContain("Office");
    expect(config.labels).toEqual([...config.types, ...config.occasions]);
    expect((await getCategoryFilters("rings")).types).toEqual(config.types);
  });

  it("falls back to empty lists for a custom store category", () => {
    expect(getDefaultFilterConfig("custom-cat").labels).toEqual([]);
  });

  it("BUG-PLP-01: saved filter config survives a fresh process", async () => {
    await saveCategoryFilters("rings", {
      types: [" Solitaire ", "Cocktail", "Solitaire"],
      occasions: ["Gifting", "Cocktail"],
      categoryName: "Rings",
    });

    jest.resetModules(); // nothing is cached in memory or on disk — only the DB remains
    const fresh = await import("@/lib/category-filters");
    const filters = await fresh.getCategoryFilters("rings");
    expect(filters.types).toEqual(["Solitaire", "Cocktail"]);
    expect(filters.occasions).toEqual(["Gifting"]); // a label can't be both a Type and an Occasion
    const all = await fresh.getAllCategoryFilters();
    expect(all.rings.types).toEqual(["Solitaire", "Cocktail"]);
    expect(all.earrings.types).toContain("Studs"); // built-ins still filled in
  });

  it("assigns products to labels, only within the category", async () => {
    db.tags.push({ productId: "earring_1", group: "TYPE", value: "Studs" });
    await saveCategoryFilters("rings", {
      types: ["Solitaire", "Band"],
      occasions: ["Gifting"],
      labelProductMap: { Solitaire: ["ring_1", "earring_1"], Gifting: ["ring_2"] },
    });
    expect(db.tags).toEqual(
      expect.arrayContaining([
        { productId: "ring_1", group: "TYPE", value: "Solitaire" },
        { productId: "ring_2", group: "OCCASION", value: "Gifting" },
        { productId: "earring_1", group: "TYPE", value: "Studs" },
      ]),
    );
    expect(db.tags.some((t) => t.productId === "earring_1" && t.value === "Solitaire")).toBe(false);

    const all = await getAllCategoryFilters({ withAssignments: true });
    expect(all.rings.labelProductMap).toEqual({ Solitaire: ["ring_1"], Gifting: ["ring_2"] });
  });

  it("sets a product's labels, grouping by the category lists and adding unknown ones as Types", async () => {
    await saveCategoryFilters("earrings", { types: ["Studs", "Drops"], occasions: ["Office"] });

    await setProductLabels("earring_1", "earrings", ["Studs", "Office", "Chandelier"]);
    expect(productLabelsFromTags(db.tags.filter((t) => t.productId === "earring_1"))).toEqual([
      "Studs",
      "Chandelier",
      "Office",
    ]);
    expect((await getCategoryFilters("earrings")).types).toContain("Chandelier");

    await setProductLabels("earring_1", "earrings", ["Drops"]);
    expect(db.tags.filter((t) => t.productId === "earring_1")).toEqual([
      { productId: "earring_1", group: "TYPE", value: "Drops" },
    ]);
  });

  it("resets the option lists to defaults and keeps product tags", async () => {
    await saveCategoryFilters("rings", { types: ["Custom Floral"], occasions: [] });
    db.tags.push({ productId: "ring_1", group: "TYPE", value: "Custom Floral" });

    const reset = await resetCategoryFilters("rings");
    expect(reset.types).toContain("Solitaire");
    expect(reset.types).not.toContain("Custom Floral");
    expect(db.tags).toHaveLength(1);
  });

  it("lists a product's labels with Types before Occasions", () => {
    expect(
      productLabelsFromTags([
        { group: "OCCASION", value: "Gifting" },
        { group: "TYPE", value: "Band" },
      ]),
    ).toEqual(["Band", "Gifting"]);
    expect(productLabelsFromTags(undefined)).toEqual([]);
  });
});
