import { prisma } from "@/lib/prisma";
import { getStoreCategories } from "@/lib/store-categories";
import { getAllCategoryFilters } from "@/lib/category-filters";
import { AdminGuide } from "@/components/admin/AdminGuide";
import { FiltersManager } from "./FiltersManager";
import { SHOP_CATEGORIES, CATEGORY_LABELS } from "@/lib/catalogue-ui";

export const dynamic = "force-dynamic";

export default async function AdminFiltersPage() {
  const [storeCats, filterConfigs, dbProducts] = await Promise.all([
    getStoreCategories().catch(() => []),
    getAllCategoryFilters().catch(() => ({})),
    prisma.product
      .findMany({
        where: { isActive: true, status: "LIVE" },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          itemCode: true,
          category: true,
          designStyle: true,
          description: true,
        },
      })
      .catch(() => []),
  ]);

  // Combine built-in categories and store categories into a unified list
  const categoryMap = new Map<string, { slug: string; name: string }>();

  // Add built-in categories
  for (const slug of SHOP_CATEGORIES) {
    categoryMap.set(slug, {
      slug,
      name: CATEGORY_LABELS[slug]?.title || slug.charAt(0).toUpperCase() + slug.slice(1),
    });
  }

  // Add / override with store categories
  for (const sc of storeCats) {
    const slug = sc.slug.toLowerCase().trim();
    categoryMap.set(slug, {
      slug,
      name: sc.name,
    });
  }

  const allCategories = Array.from(categoryMap.values());

  return (
    <div className="admin-page" style={{ maxWidth: 1140 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h1 style={{ fontSize: "1.875rem", fontWeight: 400, color: "#111827", margin: 0 }}>
          Category Filters & Labels
        </h1>
      </div>

      <AdminGuide
        pageKey="filters"
        title="Category Filter Labels"
        blurb="Configure the filter labels shown to customers on the category pages (e.g. /all-products/rings). Products matching these labels will be filtered when selected by shoppers."
        tips={[
          'Add custom style labels (e.g. "Solitaire", "Cocktail", "Everyday Wear", "Bridal", "Halo") to any category.',
          'Products with matching text in their name, style, or description automatically match the filter label.',
          'You can also click on any label to explicitly assign or unassign specific products.',
          'Click "Preview Storefront" to test how the filter bar looks and behaves on the live store.',
        ]}
      />

      <FiltersManager
        categories={allCategories}
        initialConfigs={filterConfigs}
        products={dbProducts.map((p) => ({
          id: p.id,
          name: p.name,
          itemCode: p.itemCode,
          category: p.category ? p.category.toLowerCase() : "",
          designStyle: p.designStyle,
          description: p.description,
        }))}
      />
    </div>
  );
}
