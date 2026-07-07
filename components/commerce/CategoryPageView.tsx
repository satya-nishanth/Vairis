"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ProductCard } from "@/components/commerce/ProductCard";
import { PlpPostGridSection } from "@/components/commerce/PlpPostGridSection";
import { CartModalProvider } from "@/components/commerce/CartModal";
import { CategoryFilterSidebar, type FilterState } from "@/components/commerce/CategoryFilterSidebar";
import { defaultFilterState } from "@/components/commerce/CategoryFilterPanel";
import { MobileFilterBar } from "@/components/commerce/MobileFilterBar";
import { MobileFilterDrawer } from "@/components/commerce/MobileFilterDrawer";
import { CategoryHeroMediaCarousel } from "@/components/commerce/CategoryHeroMediaCarousel";
import { CategoryHeroStory } from "@/components/commerce/CategoryHeroStory";
import { CategoryPagination } from "@/components/commerce/CategoryPagination";
import type { CategoryStory } from "@/lib/category-stories";
import { getCategoryHeroImages } from "@/lib/category-hero-images";
import { pageLayouts } from "@/lib/layout-config";
import { getCategoryProducts, type Product } from "@/lib/ui-data";
import {
  CATEGORY_LABELS,
  PLP_FILTER_GROUPS,
  PLP_MOBILE_PAGE_SIZE,
  PLP_PAGE_SIZE,
  type ShopCategory,
} from "@/lib/catalogue-ui";

type CategoryPageViewProps = {
  category: ShopCategory;
  story: CategoryStory;
};

function usePlpPageSize() {
  const [pageSize, setPageSize] = useState(PLP_PAGE_SIZE);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const syncPageSize = () => {
      setPageSize(mobileQuery.matches ? PLP_MOBILE_PAGE_SIZE : PLP_PAGE_SIZE);
    };

    syncPageSize();
    mobileQuery.addEventListener("change", syncPageSize);
    return () => mobileQuery.removeEventListener("change", syncPageSize);
  }, []);

  return pageSize;
}

function filterProducts(products: Product[], filters: FilterState): Product[] {
  let result = [...products];

  if (filters.readyToShip) {
    result = result.filter((_, i) => i % 3 !== 0);
  }

  if (filters.sort === "newest") {
    result = [...result].reverse();
  }

  return result;
}

export function CategoryPageView({ category, story }: CategoryPageViewProps) {
  const layout = pageLayouts.plp;
  const meta = CATEGORY_LABELS[category];
  const allProducts = getCategoryProducts(category);
  const filterGroups = PLP_FILTER_GROUPS[category];
  const heroImages = getCategoryHeroImages(category);

  const [filters, setFilters] = useState<FilterState>(defaultFilterState());
  const [draftFilters, setDraftFilters] = useState<FilterState>(defaultFilterState());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFocusSort, setDrawerFocusSort] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = usePlpPageSize();

  const filteredProducts = useMemo(() => filterProducts(allProducts, filters), [allProducts, filters]);
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const pageProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filters, category, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    document.body.classList.add("has-mobile-sticky-bar");
    return () => document.body.classList.remove("has-mobile-sticky-bar");
  }, []);

  const openFilters = () => {
    setDraftFilters(filters);
    setDrawerFocusSort(false);
    setDrawerOpen(true);
  };

  const openSort = () => {
    setDraftFilters(filters);
    setDrawerFocusSort(true);
    setDrawerOpen(true);
  };

  const commitFilters = () => {
    setFilters(draftFilters);
  };

  return (
    <CartModalProvider bagCount={1}>
      <PageShell {...layout}>
        <section className="plp-hero plp-hero--landing">
          <div className="plp-hero__content">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: meta.title },
              ]}
            />
            <div className="plp-hero__hero-main">
              <CategoryHeroStory story={story} />
              <p className="plp-hero__intro">{meta.intro}</p>
            </div>
          </div>
          <CategoryHeroMediaCarousel images={heroImages} label={meta.title} />
        </section>

        <main className="container page-main plp-main">
          <div className="plp-layout">
            <div className="plp-products">
              <div className="plp-products__toolbar">
                <p>
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredProducts.length)} of{" "}
                  {filteredProducts.length} {meta.title.toLowerCase()}
                </p>
              </div>

              <div className="plp-grid">
                {pageProducts.map((product, i) => (
                  <ProductCard key={product.catalogueId} product={product} showActions={i < 4} />
                ))}
              </div>

              <CategoryPagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>

            <CategoryFilterSidebar
              filters={filters}
              onChange={setFilters}
              productCount={filteredProducts.length}
              groups={filterGroups}
            />
          </div>

          <PlpPostGridSection />
        </main>

        <MobileFilterBar filters={filters} onOpenFilters={openFilters} onOpenSort={openSort} />
        <MobileFilterDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          draftFilters={draftFilters}
          onDraftChange={setDraftFilters}
          onApply={commitFilters}
          groups={filterGroups}
          productCount={filteredProducts.length}
          focusSort={drawerFocusSort}
        />
      </PageShell>
    </CartModalProvider>
  );
}
