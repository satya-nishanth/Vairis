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

export async function getStoreCategories(options?: {
  inHeader?: boolean;
  activeOnly?: boolean;
}): Promise<StoreCategoryRecord[]> {
  try {
    // Attempt database query first
    const where: any = {};
    if (options?.activeOnly) where.isActive = true;
    if (options?.inHeader !== undefined) where.showInHeader = options.inHeader;

    const rows = await (prisma as any).storeCategory.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: {
        products: {
          select: {
            productId: true,
            product: { select: { id: true, isActive: true, status: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (rows && rows.length > 0) {
      const dbCategories: StoreCategoryRecord[] = rows.map((r: any) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        image: r.image,
        showInHeader: r.showInHeader,
        sortOrder: r.sortOrder,
        isActive: r.isActive,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
        productIds: (r.products ?? [])
          .filter((p: any) => !options?.activeOnly || (p.product?.isActive && p.product?.status === "LIVE"))
          .map((p: any) => p.productId),
      }));

      // Merge with default categories to make sure core storefront categories are never dropped
      const existingSlugs = new Set(dbCategories.map((c) => c.slug.toLowerCase()));
      const missingDefaults = DEFAULT_STORE_CATEGORIES.filter(
        (d) => !existingSlugs.has(d.slug.toLowerCase()),
      );
      let combined = [...dbCategories, ...missingDefaults];
      if (options?.activeOnly) {
        combined = combined.filter((c) => c.isActive);
      }
      if (options?.inHeader !== undefined) {
        combined = combined.filter((c) => c.showInHeader === options.inHeader);
      }
      return combined.sort((a, b) => a.sortOrder - b.sortOrder);
    }
  } catch {
    // Fall back to JSON storage
  }

  const items = readJsonFile();
  const existingSlugs = new Set(items.map((c) => c.slug.toLowerCase()));
  const missingDefaults = DEFAULT_STORE_CATEGORIES.filter(
    (d) => !existingSlugs.has(d.slug.toLowerCase()),
  );
  let combined = [...items, ...missingDefaults];
  if (options?.activeOnly) {
    combined = combined.filter((i) => i.isActive);
  }
  if (options?.inHeader !== undefined) {
    combined = combined.filter((i) => i.showInHeader === options.inHeader);
  }
  return combined.sort((a, b) => a.sortOrder - b.sortOrder);
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
    const row = await (prisma as any).storeCategory.findUnique({
      where: { slug: norm },
      include: {
        products: {
          select: {
            productId: true,
            product: { select: { id: true, isActive: true, status: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (row) {
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        image: row.image,
        showInHeader: row.showInHeader,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        productIds: (row.products ?? [])
          .filter((p: any) => p.product?.isActive && p.product?.status === "LIVE")
          .map((p: any) => p.productId),
      };
    }
  } catch {
    // Fall back to JSON
  }

  const items = readJsonFile();
  return items.find((c) => c.slug.toLowerCase() === norm) ?? null;
}

export async function getStoreCategoryById(id: string): Promise<StoreCategoryRecord | null> {
  try {
    const row = await (prisma as any).storeCategory.findUnique({
      where: { id },
      include: { products: { select: { productId: true } } },
    });
    if (row) {
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        image: row.image,
        showInHeader: row.showInHeader,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        productIds: (row.products ?? []).map((p: any) => p.productId),
      };
    }
  } catch {
    // Fall back to JSON
  }

  const items = readJsonFile();
  return items.find((c) => c.id === id) ?? null;
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
  const productIds = Array.isArray(input.productIds) ? input.productIds : [];

  const now = new Date().toISOString();
  const newRecord: StoreCategoryRecord = {
    id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    slug,
    name,
    description,
    image,
    showInHeader,
    sortOrder,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    productIds,
  };

  try {
    const created = await (prisma as any).storeCategory.create({
      data: {
        slug,
        name,
        description,
        image,
        showInHeader,
        sortOrder,
        isActive: true,
        products: {
          create: productIds.map((pId) => ({
            productId: pId,
          })),
        },
      },
      include: { products: { select: { productId: true } } },
    });
    newRecord.id = created.id;
  } catch (err) {
    console.warn("[store-categories] Prisma create failed, saving to local json fallback:", err);
  }

  const items = readJsonFile();
  const existingIdx = items.findIndex((i) => i.slug === slug);
  if (existingIdx >= 0) {
    items[existingIdx] = newRecord;
  } else {
    items.push(newRecord);
  }
  writeJsonFile(items);

  return newRecord;
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
  const normSlug = input.slug
    ? input.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : undefined;

  let dbRecord: StoreCategoryRecord | null = null;
  try {
    const existing = await (prisma as any).storeCategory.findFirst({
      where: { OR: [{ id }, { slug: id }, ...(normSlug ? [{ slug: normSlug }] : [])] },
      include: {
        products: { select: { productId: true }, orderBy: { sortOrder: "asc" } },
      },
    });

    if (existing) {
      const existingProductIds = (existing.products ?? []).map((p: any) => p.productId);
      const targetProductIds =
        input.productIds !== undefined ? input.productIds : existingProductIds;
      const targetSlug = normSlug ?? existing.slug;

      const updated = await (prisma as any).storeCategory.update({
        where: { id: existing.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(targetSlug && { slug: targetSlug }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.image !== undefined && { image: input.image }),
          ...(input.showInHeader !== undefined && { showInHeader: input.showInHeader }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.productIds !== undefined
            ? {
                products: {
                  deleteMany: {},
                  create: targetProductIds.map((pId: string, idx: number) => ({
                    productId: pId,
                    sortOrder: idx,
                  })),
                },
              }
            : {}),
        },
        include: { products: { select: { productId: true }, orderBy: { sortOrder: "asc" } } },
      });

      dbRecord = {
        id: updated.id,
        slug: updated.slug,
        name: updated.name,
        description: updated.description,
        image: updated.image,
        showInHeader: updated.showInHeader,
        sortOrder: updated.sortOrder,
        isActive: updated.isActive,
        createdAt: updated.createdAt ? new Date(updated.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: updated.updatedAt ? new Date(updated.updatedAt).toISOString() : new Date().toISOString(),
        productIds: (updated.products ?? []).map((p: any) => p.productId),
      };
    }
  } catch (err) {
    console.warn("[store-categories] DB update failed, falling back to JSON:", err);
  }

  const items = readJsonFile();
  const itemIndex = items.findIndex((c) => c.id === id || c.slug === id || (normSlug && c.slug === normSlug));

  if (dbRecord) {
    if (itemIndex >= 0) {
      items[itemIndex] = dbRecord;
    } else {
      items.push(dbRecord);
    }
    writeJsonFile(items);
    return dbRecord;
  }

  if (itemIndex < 0) return null;

  const current = items[itemIndex];
  const updated: StoreCategoryRecord = {
    ...current,
    ...input,
    slug: normSlug ?? current.slug,
    updatedAt: new Date().toISOString(),
    productIds: input.productIds !== undefined ? input.productIds : current.productIds,
  };

  items[itemIndex] = updated;
  writeJsonFile(items);
  return updated;
}

export async function deleteStoreCategory(id: string): Promise<boolean> {
  let dbSuccess = false;
  try {
    const existing = await (prisma as any).storeCategory.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (existing) {
      await (prisma as any).storeCategory.delete({
        where: { id: existing.id },
      });
      dbSuccess = true;
    }
  } catch (err) {
    console.warn("[store-categories] DB delete failed:", err);
  }

  const items = readJsonFile();
  const filtered = items.filter((c) => c.id !== id && c.slug !== id);
  const jsonSuccess = filtered.length !== items.length;
  if (jsonSuccess) {
    writeJsonFile(filtered);
  }

  return dbSuccess || jsonSuccess;
}
