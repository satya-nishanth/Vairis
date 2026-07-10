"use client";

import Link from "next/link";
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
import { useCart } from "@/components/commerce/CartProvider";
import type { Product } from "@/lib/ui-data";
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
  prismaProducts?: Product[];
  heroImageOverride?: string;
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

export function CategoryPageView({ category, story, prismaProducts, heroImageOverride }: CategoryPageViewProps) {
  const layout = pageLayouts.plp;
  const meta = CATEGORY_LABELS[category];
  const { count: bagCount } = useCart();
  // Only real DB products — never fall back to mock catalogue (broken PDP links)
  const allProducts = useMemo(() => prismaProducts ?? [], [prismaProducts]);
  const filterGroups = PLP_FILTER_GROUPS[category];
  // Admin banner override (SiteBanner slot plp-hero-<category>) wins over the built-in set
  const heroImages = heroImageOverride ? [heroImageOverride] : getCategoryHeroImages(category);

  const [filters, setFilters] = useState<FilterState>(defaultFilterState());
  const [draftFilters, setDraftFilters] = useState<FilterState>(defaultFilterState());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFocusSort, setDrawerFocusSort] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = usePlpPageSize();

  const filteredProducts = useMemo(() => filterProducts(allProducts, filters), [allProducts, filters]);
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  // Clamp instead of syncing state in an effect — filters/pageSize changes
  // can shrink totalPages below the stored page
  const currentPage = Math.min(page, totalPages);
  const pageProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const applyFilters = (next: FilterState) => {
    setFilters(next);
    setPage(1);
  };

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
    applyFilters(draftFilters);
  };

  return (
    <CartModalProvider bagCount={bagCount}>
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
              {filteredProducts.length === 0 ? (
                <div className="plp-empty">
                  <h2>New {meta.title.toLowerCase()} are on their way</h2>
                  <p>This collection is being curated. Explore our other pieces meanwhile.</p>
                  <Link href="/all-products/rings" className="btn btn-primary">
                    Shop Rings
                  </Link>
                </div>
              ) : (
                <>
                  <div className="plp-products__toolbar">
                    <p>
                      Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredProducts.length)} of{" "}
                      {filteredProducts.length} {meta.title.toLowerCase()}
                    </p>
                  </div>

                  <div className="plp-grid">
                    {pageProducts.map((product, i) => (
                      <ProductCard key={product.catalogueId} product={product} showActions={i < 4} />
                    ))}
                  </div>

                  <CategoryPagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
                </>
              )}
            </div>

            <CategoryFilterSidebar
              filters={filters}
              onChange={applyFilters}
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
