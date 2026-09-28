import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getStoreCategories } from "@/lib/store-categories";
import { AdminGuide } from "@/components/admin/AdminGuide";
import { CategoriesManager } from "./CategoriesManager";
import { catalogueProducts } from "@/lib/catalogue-ui";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const [categories, dbProducts] = await Promise.all([
    getStoreCategories(),
    prisma.product
      .findMany({
        orderBy: [{ category: "asc" }, { name: "asc" }],
        select: { id: true, name: true, itemCode: true, category: true, status: true, isActive: true },
      })
      .catch(() => []),
  ]);

  const productsMap = new Map<string, { id: string; name: string; itemCode: string | null; category: string; status: string; isActive: boolean }>();

  if (dbProducts && dbProducts.length > 0) {
    for (const p of dbProducts) {
      productsMap.set(p.id, {
        id: p.id,
        name: p.name,
        itemCode: p.itemCode,
        category: p.category,
        status: p.status,
        isActive: p.isActive,
      });
    }
  }

  // Fallback / supplement with catalogue manifest so products are always available to assign
  if (catalogueProducts && catalogueProducts.length > 0) {
    for (const cp of catalogueProducts) {
      if (!productsMap.has(cp.id) && !productsMap.has(cp.slug)) {
        productsMap.set(cp.id, {
          id: cp.id,
          name: cp.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          itemCode: cp.sku,
          category: cp.category.toUpperCase(),
          status: "LIVE",
          isActive: true,
        });
      }
    }
  }

  const allProductsList = Array.from(productsMap.values());

  // Ensure default/existing categories have their matching products pre-assigned (ONLY active LIVE products)
  const enhancedCategories = categories.map((cat) => {
    const matchingIds = allProductsList
      .filter((p) => p.isActive && p.status === "LIVE" && p.category && (p.category.toLowerCase() === cat.slug.toLowerCase() || p.category.toUpperCase() === cat.slug.toUpperCase()))
      .map((p) => p.id);
    const mergedProductIds = Array.from(new Set([...(cat.productIds ?? []), ...matchingIds]));
    return {
      ...cat,
      productIds: mergedProductIds,
    };
  });

  return (
    <div className="admin-page" style={{ maxWidth: 1040 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h1 style={{ fontSize: "1.875rem", fontWeight: 400, color: "#111827", margin: 0 }}>
          Categories
        </h1>
        <Link
          href="/admin/filters"
          style={{
            fontSize: "0.8125rem",
            color: "#111827",
            textDecoration: "none",
            border: "1px solid #d1d5db",
            padding: "6px 12px",
            borderRadius: 6,
            background: "#ffffff",
            fontWeight: 500,
          }}
        >
          Manage Filter Labels →
        </Link>
      </div>
      <AdminGuide
        pageKey="categories"
        title="Store Categories"
        blurb="Manage product categories, organize catalogue navigation, and choose which categories display on the website header."
        tips={[
          '"Display in Header" controls whether this category link appears in the main website navigation and mobile menu.',
          'Reorder categories using the sort order numbers to organize header placement.',
          'Assign existing products to custom categories so customers can browse them at /all-products/[slug].',
        ]}
      />
      <CategoriesManager
        categories={enhancedCategories}
        allProducts={allProductsList.map((p) => ({
          id: p.id,
          label: `${p.name}${p.itemCode ? ` (${p.itemCode})` : ""}${p.status && p.status !== "LIVE" ? ` [${p.status}]` : ""}${p.isActive === false ? " [INACTIVE]" : ""} — ${p.category.toLowerCase()}`,
          category: p.category,
        }))}
      />
    </div>
  );
}
