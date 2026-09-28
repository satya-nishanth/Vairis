import fs from "fs";
import path from "path";
import {
  PLP_FILTER_GROUPS,
  SHOP_CATEGORIES,
  CATEGORY_LABELS,
  type ShopCategory,
} from "@/lib/catalogue-ui";
import { getStoreCategories } from "@/lib/store-categories";

export type CategoryFilterGroup = {
  id: "styles" | "metals";
  title: string;
  options: string[];
};

export type CategoryFilterConfig = {
  categorySlug: string;
  categoryName: string;
  labels: string[]; // Options under "styles" group (e.g. "Solitaire", "Stackable", etc.)
  metals?: string[]; // Options under "metals" group
  labelProductMap?: Record<string, string[]>; // label -> array of productIds explicitly tagged
  updatedAt: string;
};

const DATA_FILE = path.join(process.cwd(), "data", "category-filters.json");

const DEFAULT_METALS = ["Yellow Gold", "White Gold", "Rose Gold", "18K Gold"];

/**
 * Returns baseline default filters for a category from PLP_FILTER_GROUPS or sensible defaults.
 */
export function getDefaultFilterConfig(slug: string, name?: string): CategoryFilterConfig {
  const normSlug = slug.toLowerCase().trim();
  const builtIn = PLP_FILTER_GROUPS[normSlug as ShopCategory];
  const builtInTitle = CATEGORY_LABELS[normSlug as ShopCategory]?.title;

  const styleGroup = builtIn?.find((g) => g.id === "styles");
  const metalGroup = builtIn?.find((g) => g.id === "metals");

  const defaultLabels = styleGroup?.options ?? [
    "Solitaire",
    "Everyday Wear",
    "Office Wear",
    "Minimal",
    "Gifting",
  ];
  const defaultMetals = metalGroup?.options ?? DEFAULT_METALS;

  return {
    categorySlug: normSlug,
    categoryName: name || builtInTitle || normSlug.charAt(0).toUpperCase() + normSlug.slice(1),
    labels: [...defaultLabels],
    metals: [...defaultMetals],
    labelProductMap: {},
    updatedAt: new Date().toISOString(),
  };
}

function readFiltersFile(): Record<string, CategoryFilterConfig> {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("[category-filters] Failed reading category-filters.json:", err);
  }
  return {};
}

function writeFiltersFile(data: Record<string, CategoryFilterConfig>): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[category-filters] Failed writing category-filters.json:", err);
  }
}

/**
 * Returns all category filter configurations merged with available store categories.
 */
export async function getAllCategoryFilters(): Promise<Record<string, CategoryFilterConfig>> {
  const stored = readFiltersFile();
  const result: Record<string, CategoryFilterConfig> = { ...stored };

  // Ensure built-in categories have entries
  for (const slug of SHOP_CATEGORIES) {
    if (!result[slug]) {
      result[slug] = getDefaultFilterConfig(slug);
    }
  }

  // Ensure store categories have entries
  try {
    const storeCategories = await getStoreCategories();
    for (const sc of storeCategories) {
      const slug = sc.slug.toLowerCase().trim();
      if (!result[slug]) {
        result[slug] = getDefaultFilterConfig(slug, sc.name);
      } else if (!result[slug].categoryName && sc.name) {
        result[slug].categoryName = sc.name;
      }
    }
  } catch (err) {
    console.error("[category-filters] Failed merging store categories:", err);
  }

  return result;
}

/**
 * Returns filter groups and label-product mappings for a specific category.
 * Used directly by the storefront PLP (`/all-products/[category]`).
 */
export async function getCategoryFilters(slug: string): Promise<{
  groups: CategoryFilterGroup[];
  labels: string[];
  labelProductMap: Record<string, string[]>;
}> {
  const normSlug = slug.toLowerCase().trim();
  const allFilters = await getAllCategoryFilters();
  const config = allFilters[normSlug] || getDefaultFilterConfig(normSlug);

  const groups: CategoryFilterGroup[] = [];

  // Group 1: Style / Category Labels
  if (config.labels && config.labels.length > 0) {
    groups.push({
      id: "styles",
      title: "Style",
      options: config.labels,
    });
  }

  // Group 2: Metal Options
  const metals = config.metals && config.metals.length > 0 ? config.metals : DEFAULT_METALS;
  groups.push({
    id: "metals",
    title: "Metal",
    options: metals,
  });

  return {
    groups,
    labels: config.labels,
    labelProductMap: config.labelProductMap ?? {},
  };
}

/**
 * Saves updated labels, metals, and product assignments for a category.
 */
export async function saveCategoryFilters(
  slug: string,
  updates: {
    labels: string[];
    metals?: string[];
    labelProductMap?: Record<string, string[]>;
    categoryName?: string;
  }
): Promise<CategoryFilterConfig> {
  const normSlug = slug.toLowerCase().trim();
  const stored = readFiltersFile();

  const existing = stored[normSlug] || getDefaultFilterConfig(normSlug, updates.categoryName);

  // Clean and deduplicate labels
  const cleanedLabels = Array.from(
    new Set((updates.labels || []).map((l) => l.trim()).filter(Boolean))
  );

  const cleanedMetals = updates.metals
    ? Array.from(new Set(updates.metals.map((m) => m.trim()).filter(Boolean)))
    : existing.metals ?? DEFAULT_METALS;

  // Clean labelProductMap to only retain entries for valid labels
  const cleanedMap: Record<string, string[]> = {};
  if (updates.labelProductMap) {
    for (const [label, prodIds] of Object.entries(updates.labelProductMap)) {
      if (cleanedLabels.includes(label) && Array.isArray(prodIds)) {
        cleanedMap[label] = Array.from(new Set(prodIds.filter(Boolean)));
      }
    }
  }

  const updatedConfig: CategoryFilterConfig = {
    categorySlug: normSlug,
    categoryName: updates.categoryName || existing.categoryName || normSlug,
    labels: cleanedLabels,
    metals: cleanedMetals,
    labelProductMap: cleanedMap,
    updatedAt: new Date().toISOString(),
  };

  stored[normSlug] = updatedConfig;
  writeFiltersFile(stored);
  return updatedConfig;
}

/**
 * Resets a category back to default presets.
 */
export async function resetCategoryFilters(slug: string): Promise<CategoryFilterConfig> {
  const normSlug = slug.toLowerCase().trim();
  const stored = readFiltersFile();
  const defaultConfig = getDefaultFilterConfig(normSlug);
  stored[normSlug] = defaultConfig;
  writeFiltersFile(stored);
  return defaultConfig;
}

/**
 * Returns the list of filter labels a specific product is linked with
 * (both via explicit assignment in labelProductMap and via text keyword matching).
 */
export function getProductLinkedLabels(
  product: {
    id: string;
    itemCode?: string | null;
    name?: string;
    designStyle?: string | null;
    description?: string | null;
    category?: string;
    metals?: string[];
  },
  filterConfigs?: Record<string, CategoryFilterConfig> | CategoryFilterConfig
): string[] {
  if (!filterConfigs) return [];

  let config: CategoryFilterConfig | undefined;
  if ("labels" in filterConfigs && "categorySlug" in filterConfigs) {
    config = filterConfigs as CategoryFilterConfig;
  } else {
    const slug = (product.category ?? "").toLowerCase().trim();
    const map = filterConfigs as Record<string, CategoryFilterConfig>;
    config = map[slug] || map[slug.replace(/s$/, "")] || map[`${slug}s`];
  }

  if (!config || !config.labels || config.labels.length === 0) return [];

  const matchedLabels: string[] = [];
  const map = config.labelProductMap || {};
  const text = [
    product.name ?? "",
    product.itemCode ?? "",
    product.designStyle ?? "",
    product.description ?? "",
  ]
    .join(" ")
    .toLowerCase();

  for (const label of config.labels) {
    const lower = label.toLowerCase();
    const explicitIds = map[label] || [];

    const isExplicit =
      explicitIds.includes(product.id) ||
      (product.itemCode && explicitIds.includes(product.itemCode));

    if (isExplicit || text.includes(lower)) {
      matchedLabels.push(label);
    }
  }

  return matchedLabels;
}

/**
 * Updates the explicitly assigned labels for a specific product in a category.
 */
export async function setProductLabels(
  productId: string,
  categorySlug: string,
  targetLabels: string[]
): Promise<CategoryFilterConfig> {
  const normSlug = categorySlug.toLowerCase().trim();
  const allFilters = await getAllCategoryFilters();
  const config = allFilters[normSlug] || getDefaultFilterConfig(normSlug);

  const map = { ...(config.labelProductMap || {}) };

  for (const label of config.labels) {
    const list = map[label] || [];
    const shouldHave = targetLabels.includes(label);

    if (shouldHave && !list.includes(productId)) {
      map[label] = [...list, productId];
    } else if (!shouldHave && list.includes(productId)) {
      map[label] = list.filter((id) => id !== productId);
    }
  }

  return saveCategoryFilters(normSlug, {
    labels: config.labels,
    metals: config.metals,
    labelProductMap: map,
    categoryName: config.categoryName,
  });
}

