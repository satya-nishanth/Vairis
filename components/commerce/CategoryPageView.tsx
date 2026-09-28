"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import type { BannerImageFit } from "@/lib/banner-image-fit";
import {
  CATEGORY_LABELS,
  PLP_FILTER_GROUPS,
  PLP_MOBILE_PAGE_SIZE,
  PLP_PAGE_SIZE,
  isShopCategory,
  type ShopCategory,
} from "@/lib/catalogue-ui";

type CategoryPageViewProps = {
  category: string;
  titleOverride?: string;
  story: CategoryStory;
  prismaProducts?: Product[];
  heroImagesOverride?: string[];
  heroImageFits?: BannerImageFit[];
  introOverride?: string;
  filterGroups?: { id: "styles" | "metals"; title: string; options: string[] }[];
  labelProductMap?: Record<string, string[]>;
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

function filterProducts(
  products: Product[],
  filters: FilterState,
  labelProductMap?: Record<string, string[]>
): Product[] {
  let result = [...products];

  if (filters.metals.length > 0) {
    result = result.filter((p) => p.metals?.some((m) => filters.metals.includes(m)));
  }

  if (filters.styles.length > 0) {
    const wanted = filters.styles.map((s) => s.toLowerCase());
    result = result.filter((p) => {
      // 1. Explicitly mapped label check
      const isExplicitlyTagged = filters.styles.some((label) => {
        const mapped = labelProductMap?.[label];
        return (
          mapped &&
          (mapped.includes(p.slug) ||
            mapped.includes(p.sku ?? "") ||
            (p.catalogueId && mapped.includes(p.catalogueId)))
        );
      });
      if (isExplicitlyTagged) return true;

      // 2. Keyword/style match across product attributes
      const text = [
        p.styleText ?? "",
        p.description ?? "",
        p.name ?? "",
        p.sku ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return wanted.some((s) => text.includes(s));
    });
  }

  if (filters.readyToShip) {
    result = result.filter((p) => p.inStock);
  }

  switch (filters.sort) {
    case "newest":
      // Server orders by createdAt asc — reversed = newest first.
      result = [...result].reverse();
      break;
    case "price-asc":
      result = [...result].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
      break;
    case "price-desc":
      result = [...result].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
      break;
    // "popular" keeps the curated server order
  }

  return result;
}

function parseFiltersFromSearchParams(params: { get: (k: string) => string | null; getAll: (k: string) => string[] } | null): FilterState {
  const defaults = defaultFilterState();
  if (!params) return defaults;
  const sort = params.get("sort");
  const styles = params.getAll("style").flatMap((s) => s.split(",")).filter(Boolean);
  const metals = params.getAll("metal").flatMap((m) => m.split(",")).filter(Boolean);
  const readyToShip = params.get("readyToShip") === "true";

  const validSorts: FilterState["sort"][] = ["popular", "newest", "price-asc", "price-desc"];
  return {
    sort: sort && validSorts.includes(sort as FilterState["sort"]) ? (sort as FilterState["sort"]) : defaults.sort,
    styles,
    metals,
    readyToShip,
  };
}

export function CategoryPageView({
  category,
  titleOverride,
  story,
  prismaProducts,
  heroImagesOverride,
  heroImageFits,
  introOverride,
  filterGroups: filterGroupsProp,
  labelProductMap,
}: CategoryPageViewProps) {
  const layout = pageLayouts.plp;
  const isBuiltIn = isShopCategory(category);
  const meta = isBuiltIn
    ? CATEGORY_LABELS[category]
    : {
        title: titleOverride || category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, " "),
        description: "",
        intro: `Explore our curated ${category.replace(/-/g, " ")} collection.`,
        emotional: "",
      };
  const { count: bagCount } = useCart();
  // Only real DB products — never fall back to mock catalogue (broken PDP links)
  const allProducts = useMemo(() => prismaProducts ?? [], [prismaProducts]);
  const filterGroups =
    filterGroupsProp && filterGroupsProp.length > 0
      ? filterGroupsProp
      : isBuiltIn && PLP_FILTER_GROUPS[category]
      ? PLP_FILTER_GROUPS[category]
      : [
          {
            id: "metals" as const,
            title: "Metal",
            options: ["Yellow Gold", "White Gold", "Rose Gold", "18K Gold"],
          },
        ];
  // Admin SiteBanner images[] win over built-in category hero set
  const heroImages =
    heroImagesOverride && heroImagesOverride.length > 0
      ? heroImagesOverride
      : (isBuiltIn ? getCategoryHeroImages(category) : []);
  const imageFits =
    heroImagesOverride && heroImagesOverride.length > 0 ? heroImageFits : undefined;
  const intro = introOverride?.trim() || meta.intro;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const hasPricedProducts = useMemo(
    () => allProducts.some((p) => p.price != null && !p.priceHidden),
    [allProducts]
  );

  const [filters, setFilters] = useState<FilterState>(() => parseFiltersFromSearchParams(searchParams));
  const [draftFilters, setDraftFilters] = useState<FilterState>(() => parseFiltersFromSearchParams(searchParams));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFocusSort, setDrawerFocusSort] = useState(false);
  const pageSize = usePlpPageSize();
  const productsTopRef = useRef<HTMLDivElement>(null);

  // Sync state if user clicks browser back/forward
  useEffect(() => {
    const parsed = parseFiltersFromSearchParams(searchParams);
    setFilters(parsed);
  }, [searchParams]);

  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const pageFromUrl = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const filteredProducts = useMemo(
    () => filterProducts(allProducts, filters, labelProductMap),
    [allProducts, filters, labelProductMap]
  );
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(pageFromUrl, totalPages);
  const pageProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const buildHrefWithFilters = (targetPage: number, nextFilters: FilterState) => {
    const params = new URLSearchParams();
    if (nextFilters.sort && nextFilters.sort !== "popular") {
      params.set("sort", nextFilters.sort);
    }
    if (nextFilters.styles.length > 0) {
      params.set("style", nextFilters.styles.join(","));
    }
    if (nextFilters.metals.length > 0) {
      params.set("metal", nextFilters.metals.join(","));
    }
    if (nextFilters.readyToShip) {
      params.set("readyToShip", "true");
    }
    if (targetPage > 1) {
      params.set("page", String(targetPage));
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const buildHref = (targetPage: number) => {
    return buildHrefWithFilters(targetPage, filters);
  };

  const applyFilters = (next: FilterState) => {
    const effectiveSort = (!hasPricedProducts && (next.sort === "price-asc" || next.sort === "price-desc"))
      ? "popular"
      : next.sort;
    const sanitizedNext = { ...next, sort: effectiveSort };
    setFilters(sanitizedNext);
    router.push(buildHrefWithFilters(1, sanitizedNext), { scroll: false });
  };

  const handlePageChange = (nextPage: number) => {
    router.push(buildHref(nextPage), { scroll: false });
    // Scroll to the top of the products list, not the page — the hero above it is tall, and
    // re-showing it on every page change just makes the user scroll past it again. Offset by the
    // sticky header's actual height (measured, not hardcoded — it already differs mobile vs
    // desktop) so the list doesn't land hidden underneath it.
    const target = productsTopRef.current;
    if (target) {
      const headerHeight = document.querySelector(".site-header")?.getBoundingClientRect().height ?? 0;
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight;
      window.scrollTo({ top, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
              <p className="plp-hero__intro">{intro}</p>
            </div>
          </div>
          <CategoryHeroMediaCarousel
            images={heroImages}
            label={meta.title}
            imageFits={imageFits}
          />
        </section>

        <main className="container page-main plp-main">
          <div className="plp-layout">
            <div className="plp-products" ref={productsTopRef}>
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

                  <CategoryPagination
                    page={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    buildHref={buildHref}
                  />
                </>
              )}
            </div>

            <CategoryFilterSidebar
              filters={filters}
              onChange={applyFilters}
              productCount={filteredProducts.length}
              groups={filterGroups}
              hasPricedProducts={hasPricedProducts}
            />
          </div>

          <PlpPostGridSection category={category} />
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
          hasPricedProducts={hasPricedProducts}
        />
      </PageShell>
    </CartModalProvider>
  );
}
