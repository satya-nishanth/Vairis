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

  // Do NOT merge enum-matched product ids into category.productIds — that poisoned
  // edit/save (FK failures) and made delete/edit look broken for DB-backed categories.
  // CategoriesManager computes the badge count from allProducts + assigned ids.

  return (
    <div className="admin-page" style={{ maxWidth: 1040 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h1 style={{ fontSize: "1.875rem", fontWeight: 400, color: "#111827", margin: 0 }}>
          Categories
        </h1>
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
        categories={categories}
        allProducts={allProductsList.map((p) => ({
          id: p.id,
          label: `${p.name}${p.itemCode ? ` (${p.itemCode})` : ""}${p.status && p.status !== "LIVE" ? ` [${p.status}]` : ""}${p.isActive === false ? " [INACTIVE]" : ""} — ${p.category.toLowerCase()}`,
          category: p.category,
        }))}
      />
    </div>
  );
}
