import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

export type StoreCategoryRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image: string | null;
  showInHeader: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  productIds: string[];
};

export const DEFAULT_STORE_CATEGORIES: StoreCategoryRecord[] = [
  {
    id: "cat_rings",
    slug: "rings",
    name: "Rings",
    description: "Stackable bands and solitaires designed for everyday wear.",
    image: "/images/categories/rings.jpg",
    showInHeader: true,
    sortOrder: 1,
    isActive: true,
    createdAt: new Date("2026-01-01").toISOString(),
    updatedAt: new Date("2026-01-01").toISOString(),
    productIds: [],
  },
  {
    id: "cat_earrings",
    slug: "earrings",
    name: "Earrings",
    description: "Delicate studs and drops made for coffee runs and evenings.",
    image: "/images/categories/earrings.jpg",
    showInHeader: true,
    sortOrder: 2,
    isActive: true,
    createdAt: new Date("2026-01-01").toISOString(),
    updatedAt: new Date("2026-01-01").toISOString(),
    productIds: [],
  },
  {
    id: "cat_pendants",
    slug: "pendants",
    name: "Pendants",
    description: "Timeless solitaires on fine chains — your everyday signature.",
    image: "/images/categories/pendants.jpg",
    showInHeader: true,
    sortOrder: 3,
    isActive: true,
    createdAt: new Date("2026-01-01").toISOString(),
    updatedAt: new Date("2026-01-01").toISOString(),
    productIds: [],
  },
  {
    id: "cat_bracelets",
    slug: "bracelets",
    name: "Bracelets",
    description: "Light tennis and chain bracelets that layer beautifully.",
    image: "/images/categories/bracelets.jpg",
    showInHeader: true,
    sortOrder: 4,
    isActive: true,
    createdAt: new Date("2026-01-01").toISOString(),
    updatedAt: new Date("2026-01-01").toISOString(),
    productIds: [],
  },
  {
    id: "cat_mangalsutra",
    slug: "mangalsutra",
    name: "Mangalsutra",
    description: "Modern diamond mangalsutras designed for everyday grace.",
    image: "/images/categories/mangalsutra.jpg",
    showInHeader: true,
    sortOrder: 5,
    isActive: true,
    createdAt: new Date("2026-01-01").toISOString(),
    updatedAt: new Date("2026-01-01").toISOString(),
    productIds: [],
  },
  {
    id: "cat_necklaces",
    slug: "necklaces",
    name: "Necklaces",
    description: "Minimal diamonds designed for workdays, dinners and confidence.",
    image: "/images/categories/necklaces.jpg",
    showInHeader: false,
    sortOrder: 6,
    isActive: true,
    createdAt: new Date("2026-01-01").toISOString(),
    updatedAt: new Date("2026-01-01").toISOString(),
    productIds: [],
  },
];

const DATA_FILE = path.join(process.cwd(), "data", "store-categories.json");

const categoryInclude = {
  products: {
    select: {
      productId: true,
      product: { select: { id: true, isActive: true, status: true } },
    },
    orderBy: { sortOrder: "asc" as const },
  },
};

function mapRow(
  r: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    image: string | null;
    showInHeader: boolean;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    products?: { productId: string; product?: { isActive: boolean; status: string } | null }[];
  },
  options?: { activeOnly?: boolean },
): StoreCategoryRecord {
  // Keep ALL linked product ids for admin/mutations. LIVE filter is only for
  // storefront-facing reads (activeOnly) — otherwise draft links get wiped on save.
  const productIds = (r.products ?? [])
    .filter((p) => {
      if (!options?.activeOnly) return true;
      return p.product?.isActive && p.product?.status === "LIVE";
    })
    .map((p) => p.productId);

  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    image: r.image,
    showInHeader: r.showInHeader,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    productIds,
  };
}

function readJsonFile(): StoreCategoryRecord[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("[store-categories] failed reading fallback json:", err);
  }
  return DEFAULT_STORE_CATEGORIES;
}

function writeJsonFile(items: StoreCategoryRecord[]) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.error("[store-categories] failed writing fallback json:", err);
  }
}

/** Mirror DB → JSON so local fallback never diverges after mutations. */
async function syncJsonFromDb() {
  try {
    const rows = await prisma.storeCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: categoryInclude,
    });
    writeJsonFile(rows.map((r) => mapRow(r)));
  } catch (err) {
    console.warn("[store-categories] JSON sync skipped:", err);
  }
}

/**
 * Ensure built-in default categories exist in DB (by slug). Never deletes or
 * overwrites existing rows. Seeds only DEFAULT_STORE_CATEGORIES — not the JSON
 * file — so deleting a custom category cannot be undone by re-seed on next read.
 */
async function ensureDefaultCategoriesInDb(): Promise<void> {
  const existing = await prisma.storeCategory.findMany({ select: { slug: true } });
  const have = new Set(existing.map((e) => e.slug.toLowerCase()));

  for (const item of DEFAULT_STORE_CATEGORIES) {
    if (have.has(item.slug.toLowerCase())) continue;
    try {
      await prisma.storeCategory.create({
        data: {
          slug: item.slug,
          name: item.name,
          description: item.description,
          image: item.image,
          showInHeader: item.showInHeader,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
        },
      });
      have.add(item.slug.toLowerCase());
    } catch (err) {
      console.warn(`[store-categories] seed failed slug=${item.slug}:`, err);
    }
  }
}

function filterJsonItems(
  items: StoreCategoryRecord[],
  options?: { inHeader?: boolean; activeOnly?: boolean },
): StoreCategoryRecord[] {
  let next = items;
  if (options?.activeOnly) next = next.filter((i) => i.isActive);
  if (options?.inHeader !== undefined) {
    next = next.filter((i) => i.showInHeader === options.inHeader);
  }
  return next.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getStoreCategories(options?: {
  inHeader?: boolean;
  activeOnly?: boolean;
}): Promise<StoreCategoryRecord[]> {
  try {
    await ensureDefaultCategoriesInDb();

    const where: { isActive?: boolean; showInHeader?: boolean } = {};
    if (options?.activeOnly) where.isActive = true;
    if (options?.inHeader !== undefined) where.showInHeader = options.inHeader;

    const rows = await prisma.storeCategory.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: categoryInclude,
    });

    // DB is source of truth whenever the query succeeds.
    return rows.map((r) => mapRow(r, options));
  } catch {
    // Table missing / Prisma down → JSON fallback only.
    return filterJsonItems(readJsonFile(), options);
  }
}

export async function getHeaderNavCategories(): Promise<{ slug: string; name: string }[]> {
  const categories = await getStoreCategories({ inHeader: true, activeOnly: true });
  return categories.map((c) => ({
    slug: c.slug,
    name: c.name,
  }));
}

export async function getStoreCategoryBySlug(slug: string): Promise<StoreCategoryRecord | null> {
  const norm = slug.trim().toLowerCase();
  try {
    await ensureDefaultCategoriesInDb();
    const row = await prisma.storeCategory.findUnique({
      where: { slug: norm },
      include: categoryInclude,
    });
    // DB healthy: miss = null. Do not fall through to JSON (avoids ghost categories).
    return row ? mapRow(row) : null;
  } catch {
    // Prisma/table unavailable → JSON fallback only.
    const items = readJsonFile();
    return items.find((c) => c.slug.toLowerCase() === norm) ?? null;
  }
}

export async function getStoreCategoryById(id: string): Promise<StoreCategoryRecord | null> {
  try {
    const row = await prisma.storeCategory.findUnique({
      where: { id },
      include: categoryInclude,
    });
    if (row) return mapRow(row);

    // Allow lookup by slug if callers pass slug as id
    const bySlug = await prisma.storeCategory.findUnique({
      where: { slug: id },
      include: categoryInclude,
    });
    return bySlug ? mapRow(bySlug) : null;
  } catch {
    const items = readJsonFile();
    return items.find((c) => c.id === id || c.slug === id) ?? null;
  }
}

export async function createStoreCategory(input: {
  name: string;
  slug?: string;
  description?: string | null;
  image?: string | null;
  showInHeader?: boolean;
  sortOrder?: number;
  productIds?: string[];
}): Promise<StoreCategoryRecord> {
  const slug = (input.slug || input.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  const image = input.image?.trim() || null;
  const showInHeader = input.showInHeader ?? true;
  const sortOrder = input.sortOrder ?? 10;
  const productIds = Array.isArray(input.productIds) ? input.productIds.filter(Boolean) : [];

  await ensureDefaultCategoriesInDb();

  const created = await prisma.storeCategory.create({
    data: {
      slug,
      name,
      description,
      image,
      showInHeader,
      sortOrder,
      isActive: true,
      products: {
        create: productIds.map((productId) => ({ productId })),
      },
    },
    include: categoryInclude,
  });

  void syncJsonFromDb();
  return mapRow(created);
}

export async function updateStoreCategory(
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    description: string | null;
    image: string | null;
    showInHeader: boolean;
    sortOrder: number;
    isActive: boolean;
    productIds: string[];
  }>,
): Promise<StoreCategoryRecord | null> {
  const current = await getStoreCategoryById(id);
  if (!current) return null;

  const nextSlug = input.slug
    ? input.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : current.slug;
  let nextProductIds =
    input.productIds !== undefined ? input.productIds.filter(Boolean) : current.productIds;

  // Drop ids that are not real Product rows (catalogue stubs / enum-merge noise).
  if (input.productIds !== undefined && nextProductIds.length > 0) {
    const existing = await prisma.product.findMany({
      where: { id: { in: nextProductIds } },
      select: { id: true },
    });
    const ok = new Set(existing.map((p) => p.id));
    nextProductIds = nextProductIds.filter((pid) => ok.has(pid));
  }

  try {
    const updated = await prisma.storeCategory.update({
      where: { id: current.id },
      data: {
        name: input.name ?? current.name,
        slug: nextSlug,
        description: input.description !== undefined ? input.description : current.description,
        image: input.image !== undefined ? input.image : current.image,
        showInHeader: input.showInHeader ?? current.showInHeader,
        sortOrder: input.sortOrder ?? current.sortOrder,
        isActive: input.isActive ?? current.isActive,
        ...(input.productIds !== undefined
          ? {
              products: {
                deleteMany: {},
                create: nextProductIds.map((productId) => ({ productId })),
              },
            }
          : {}),
      },
      include: categoryInclude,
    });
    void syncJsonFromDb();
    return mapRow(updated);
  } catch (err) {
    console.error("[store-categories] Prisma update failed:", err);
    throw err instanceof Error ? err : new Error("Failed to update category");
  }
}

export async function deleteStoreCategory(id: string): Promise<boolean> {
  const current = await getStoreCategoryById(id);
  if (!current) return false;

  try {
    await prisma.storeCategory.delete({ where: { id: current.id } });
    void syncJsonFromDb();
    return true;
  } catch (err) {
    console.error("[store-categories] Prisma delete failed:", err);
    throw err instanceof Error ? err : new Error("Failed to delete category");
  }
}

/**
 * Move a product onto one store category: drop prior StoreCategoryProduct rows,
 * then link to the target. Prefer this from product create/update.
 */
export async function assignProductToStoreCategory(
  categorySlug: string,
  productId: string,
): Promise<void> {
  const norm = categorySlug.trim().toLowerCase().replace(/_/g, "-");
  const cat = await getStoreCategoryBySlug(norm);
  if (!cat) return;

  await prisma.$transaction([
    prisma.storeCategoryProduct.deleteMany({ where: { productId } }),
    prisma.storeCategoryProduct.create({
      data: { categoryId: cat.id, productId },
    }),
  ]);
  await syncJsonFromDb();
}

/** @deprecated Use assignProductToStoreCategory (move semantics). */
export async function linkProductToStoreCategory(
  categorySlug: string,
  productId: string,
): Promise<void> {
  return assignProductToStoreCategory(categorySlug, productId);
}

/** Map form/store slug → Prisma Product.category enum, or null for custom store cats. */
export function toPrismaProductCategory(
  input: string,
): "RINGS" | "EARRINGS" | "PENDANTS" | "BRACELETS" | "NECKLACES" | null {
  const upper = input.trim().toUpperCase().replace(/-/g, "_");
  const allowed = ["RINGS", "EARRINGS", "PENDANTS", "BRACELETS", "NECKLACES"] as const;
  return (allowed as readonly string[]).includes(upper)
    ? (upper as (typeof allowed)[number])
    : null;
}
