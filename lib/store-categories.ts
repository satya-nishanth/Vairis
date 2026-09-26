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
      include: { products: { select: { productId: true } } },
    });

    if (rows && rows.length > 0) {
      return rows.map((r: any) => ({
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
        productIds: (r.products ?? []).map((p: any) => p.productId),
      }));
    }
  } catch {
    // Fall back to JSON storage
  }

  let items = readJsonFile();
  if (options?.activeOnly) {
    items = items.filter((i) => i.isActive);
  }
  if (options?.inHeader !== undefined) {
    items = items.filter((i) => i.showInHeader === options.inHeader);
  }
  return items.sort((a, b) => a.sortOrder - b.sortOrder);
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
  const items = readJsonFile();
  const itemIndex = items.findIndex((c) => c.id === id || c.slug === id);
  if (itemIndex < 0) return null;

  const current = items[itemIndex];
  const updated: StoreCategoryRecord = {
    ...current,
    ...input,
    slug: input.slug ? input.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-") : current.slug,
    updatedAt: new Date().toISOString(),
    productIds: input.productIds !== undefined ? input.productIds : current.productIds,
  };

  try {
    await (prisma as any).storeCategory.update({
      where: { id: current.id },
      data: {
        name: updated.name,
        slug: updated.slug,
        description: updated.description,
        image: updated.image,
        showInHeader: updated.showInHeader,
        sortOrder: updated.sortOrder,
        isActive: updated.isActive,
        ...(input.productIds !== undefined
          ? {
              products: {
                deleteMany: {},
                create: updated.productIds.map((pId) => ({ productId: pId })),
              },
            }
          : {}),
      },
    });
  } catch {
    // Ignore DB error, update JSON
  }

  items[itemIndex] = updated;
  writeJsonFile(items);
  return updated;
}

export async function deleteStoreCategory(id: string): Promise<boolean> {
  const items = readJsonFile();
  const filtered = items.filter((c) => c.id !== id && c.slug !== id);
  if (filtered.length === items.length) return false;

  try {
    await (prisma as any).storeCategory.delete({
      where: { id },
    });
  } catch {
    // Ignore DB error
  }

  writeJsonFile(filtered);
  return true;
}
