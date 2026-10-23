import type { ProductTagGroup } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SHOP_CATEGORIES } from "@/lib/catalogue-ui";
import { SLUG_TO_PRISMA } from "@/lib/categories";
import { getStoreCategories } from "@/lib/store-categories";

/**
 * PLP filter options (Type, Occasion) per category + product tags.
 * Stored in CategoryFilterConfig / ProductTag — the migration seeds the same defaults.
 */
export type CategoryFilterConfig = {
  categorySlug: string;
  categoryName: string;
  types: string[];
  occasions: string[];
  /** types + occasions, for pickers that treat them as one list */
  labels: string[];
  /** label -> ids of this category's products carrying it (only when assignments are loaded) */
  labelProductMap: Record<string, string[]>;
  updatedAt: string;
};

export type ProductTagRow = { group: ProductTagGroup; value: string };

export const DEFAULT_FILTER_OPTIONS: Record<string, { types: string[]; occasions: string[] }> = {
  rings: { types: ["Solitaire", "Stackable", "Band"], occasions: ["Everyday", "Office", "Gifting"] },
  necklaces: { types: ["Solitaire", "Layering", "Minimal"], occasions: ["Everyday", "Office"] },
  earrings: { types: ["Studs", "Drops", "Hoops"], occasions: ["Everyday", "Office"] },
  bracelets: { types: ["Tennis", "Chain", "Layering", "Minimal"], occasions: [] },
  pendants: { types: ["Solitaire", "Minimal"], occasions: ["Everyday", "Gifting"] },
  mangalsutra: { types: ["Modern", "Traditional", "Solitaire", "Minimal"], occasions: ["Everyday"] },
  cufflinks: { types: ["Classic", "Modern"], occasions: ["Gifting"] },
  sets: { types: ["Necklace & Earrings", "Bridal"], occasions: ["Gifting"] },
  "nose-pins": { types: ["Stud", "Minimal"], occasions: ["Everyday"] },
};

const clean = (list: string[] | undefined) =>
  Array.from(new Set((list ?? []).map((l) => l.trim()).filter(Boolean)));

const titleCase = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");

function buildConfig(
  slug: string,
  opts: { types: string[]; occasions: string[]; name?: string | null; updatedAt?: Date },
  labelProductMap: Record<string, string[]> = {},
): CategoryFilterConfig {
  return {
    categorySlug: slug,
    categoryName: opts.name || titleCase(slug),
    types: opts.types,
    occasions: opts.occasions,
    labels: [...opts.types, ...opts.occasions],
    labelProductMap,
    updatedAt: (opts.updatedAt ?? new Date()).toISOString(),
  };
}

/** Built-in defaults for a category (empty lists for custom store categories). */
export function getDefaultFilterConfig(slug: string, name?: string): CategoryFilterConfig {
  const norm = slug.toLowerCase().trim();
  const d = DEFAULT_FILTER_OPTIONS[norm] ?? { types: [], occasions: [] };
  return buildConfig(norm, { types: [...d.types], occasions: [...d.occasions], name });
}

/** Tag labels on a product, Types first. */
export function productLabelsFromTags(tags: ProductTagRow[] | undefined | null): string[] {
  const list = tags ?? [];
  return [
    ...list.filter((t) => t.group === "TYPE").map((t) => t.value),
    ...list.filter((t) => t.group === "OCCASION").map((t) => t.value),
  ];
}

/** label -> product ids, for one category's products (enum categories only). */
async function loadLabelProductMaps(): Promise<Record<string, Record<string, string[]>>> {
  const tags = await prisma.productTag.findMany({
    select: { value: true, productId: true, product: { select: { category: true } } },
  });
  const bySlug: Record<string, Record<string, string[]>> = {};
  for (const t of tags) {
    const slug = t.product.category.toLowerCase();
    ((bySlug[slug] ??= {})[t.value] ??= []).push(t.productId);
  }
  return bySlug;
}

/**
 * All category configs: stored rows, built-in defaults, and store categories.
 * `withAssignments` also loads which products carry each label (admin filters page).
 */
export async function getAllCategoryFilters(
  options: { withAssignments?: boolean } = {},
): Promise<Record<string, CategoryFilterConfig>> {
  const [rows, maps] = await Promise.all([
    prisma.categoryFilterConfig.findMany(),
    options.withAssignments ? loadLabelProductMaps() : Promise.resolve<Record<string, Record<string, string[]>>>({}),
  ]);
  const result: Record<string, CategoryFilterConfig> = {};

  for (const row of rows) {
    result[row.categorySlug] = buildConfig(
      row.categorySlug,
      { types: row.types, occasions: row.occasions, name: row.categoryName, updatedAt: row.updatedAt },
      maps[row.categorySlug],
    );
  }
  for (const slug of SHOP_CATEGORIES) {
    result[slug] ??= { ...getDefaultFilterConfig(slug), labelProductMap: maps[slug] ?? {} };
  }

  try {
    for (const sc of await getStoreCategories()) {
      const slug = sc.slug.toLowerCase().trim();
      const stored = rows.find((r) => r.categorySlug === slug);
      result[slug] ??= { ...getDefaultFilterConfig(slug), labelProductMap: maps[slug] ?? {} };
      if (!stored?.categoryName && sc.name) result[slug].categoryName = sc.name;
    }
  } catch (err) {
    console.error("[category-filters] Failed merging store categories:", err);
  }

  return result;
}

/** Option lists for one category (storefront PLP). */
export async function getCategoryFilters(slug: string): Promise<CategoryFilterConfig> {
  const norm = slug.toLowerCase().trim();
  const row = await prisma.categoryFilterConfig.findUnique({ where: { categorySlug: norm } });
  if (!row) return getDefaultFilterConfig(norm);
  return buildConfig(norm, {
    types: row.types,
    occasions: row.occasions,
    name: row.categoryName,
    updatedAt: row.updatedAt,
  });
}

/** Sets which of a category's products carry each label (enum categories only). */
async function syncAssignments(
  slug: string,
  config: { types: string[]; occasions: string[] },
  labelProductMap: Record<string, string[]>,
) {
  const category = SLUG_TO_PRISMA[slug];
  if (!category) return;
  const products = await prisma.product.findMany({ where: { category }, select: { id: true } });
  const productIds = products.map((p) => p.id);
  const groupOf = (label: string): ProductTagGroup => (config.occasions.includes(label) ? "OCCASION" : "TYPE");

  const wanted = Object.entries(labelProductMap).flatMap(([label, ids]) =>
    config.types.includes(label) || config.occasions.includes(label)
      ? ids.filter((id) => productIds.includes(id)).map((productId) => ({ productId, group: groupOf(label), value: label }))
      : [],
  );
  const labels = [...config.types, ...config.occasions];
  await prisma.$transaction([
    prisma.productTag.deleteMany({ where: { productId: { in: productIds }, value: { in: labels } } }),
    prisma.productTag.createMany({ data: wanted, skipDuplicates: true }),
  ]);
}

/** Saves a category's option lists (and optionally which products carry each label). */
export async function saveCategoryFilters(
  slug: string,
  updates: {
    types: string[];
    occasions: string[];
    labelProductMap?: Record<string, string[]>;
    categoryName?: string;
  },
): Promise<CategoryFilterConfig> {
  const norm = slug.toLowerCase().trim();
  const types = clean(updates.types);
  const occasions = clean(updates.occasions).filter((o) => !types.includes(o));
  const categoryName = updates.categoryName?.trim() || undefined;

  const row = await prisma.categoryFilterConfig.upsert({
    where: { categorySlug: norm },
    create: { categorySlug: norm, categoryName: categoryName ?? null, types, occasions },
    update: { types, occasions, ...(categoryName ? { categoryName } : {}) },
  });
  if (updates.labelProductMap) await syncAssignments(norm, { types, occasions }, updates.labelProductMap);

  return buildConfig(norm, {
    types: row.types,
    occasions: row.occasions,
    name: row.categoryName,
    updatedAt: row.updatedAt,
  });
}

/** Resets a category's option lists to the built-in defaults. Product tags are kept. */
export async function resetCategoryFilters(slug: string): Promise<CategoryFilterConfig> {
  const norm = slug.toLowerCase().trim();
  const d = getDefaultFilterConfig(norm);
  return saveCategoryFilters(norm, { types: d.types, occasions: d.occasions });
}

/**
 * Replaces the labels one product carries within its category's option lists.
 * Labels not yet in the lists are added as Types.
 */
export async function setProductLabels(
  productId: string,
  categorySlug: string,
  targetLabels: string[],
): Promise<CategoryFilterConfig> {
  const norm = categorySlug.toLowerCase().trim();
  const target = clean(targetLabels);
  let config = await getCategoryFilters(norm);

  const unknown = target.filter((l) => !config.labels.includes(l));
  if (unknown.length > 0) {
    config = await saveCategoryFilters(norm, {
      types: [...config.types, ...unknown],
      occasions: config.occasions,
    });
  }

  const data = target.map((value) => ({
    productId,
    value,
    group: (config.occasions.includes(value) ? "OCCASION" : "TYPE") as ProductTagGroup,
  }));
  await prisma.$transaction([
    prisma.productTag.deleteMany({ where: { productId, value: { in: config.labels } } }),
    prisma.productTag.createMany({ data, skipDuplicates: true }),
  ]);
  return config;
}
