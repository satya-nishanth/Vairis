"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ProductCard } from "@/components/commerce/ProductCard";
import { PlpPostGridSection } from "@/components/commerce/PlpPostGridSection";
import { CartModalProvider } from "@/components/commerce/CartModal";
import { PlpFilterSidebar } from "@/components/commerce/PlpFilterSidebar";
import { PlpFilterSheet } from "@/components/commerce/PlpFilterSheet";
import { PlpSortSheet } from "@/components/commerce/PlpSortSheet";
import { PlpMobileBar } from "@/components/commerce/PlpMobileBar";
import { CategoryHeroMediaCarousel } from "@/components/commerce/CategoryHeroMediaCarousel";
import { CategoryHeroStory } from "@/components/commerce/CategoryHeroStory";
import { CategoryPagination } from "@/components/commerce/CategoryPagination";
import type { CategoryStory } from "@/lib/category-stories";
import { getCategoryHeroImages, getCategoryFallbackHero } from "@/lib/category-hero-images";
import { pageLayouts } from "@/lib/layout-config";
import { useCart } from "@/components/commerce/CartProvider";
import type { Product } from "@/lib/ui-data";
import type { BannerImageFit } from "@/lib/banner-image-fit";
import { CATEGORY_LABELS, PLP_PAGE_SIZE, isShopCategory } from "@/lib/catalogue-ui";
import {
  SORT_OPTIONS,
  activeFilterCount,
  distinctShapes,
  facetCounts,
  filterProducts,
  parseFilters,
  serializeFilters,
  sortProducts,
  type PlpFilters,
} from "@/lib/plp-facets";
import { goldSummary } from "@/lib/plp-gold-summary";
import { rememberPlpVisit, takePlpReturn } from "@/lib/plp-return";

type CategoryPageViewProps = {
  category: string;
  titleOverride?: string;
  story: CategoryStory;
  prismaProducts?: Product[];
  heroImagesOverride?: string[];
  heroImageFits?: BannerImageFit[];
  introOverride?: string;
  /** Type / Occasion options for this category (admin-editable) */
  filterOptions?: { types: string[]; occasions: string[] };
};

const NO_OPTIONS = { types: [], occasions: [] };

export function CategoryPageView({
  category,
  titleOverride,
  story,
  prismaProducts,
  heroImagesOverride,
  heroImageFits,
  introOverride,
  filterOptions = NO_OPTIONS,
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
  const noun = meta.title.toLowerCase();
  const { count: bagCount } = useCart();
  // Only real DB products — never fall back to mock catalogue (broken PDP links)
  const allProducts = useMemo(() => prismaProducts ?? [], [prismaProducts]);
  // Admin SiteBanner images[] win over built-in category hero set
  const heroImages =
    heroImagesOverride && heroImagesOverride.length > 0
      ? heroImagesOverride
      : isBuiltIn
        ? getCategoryHeroImages(category)
        : [];
  const imageFits = heroImagesOverride && heroImagesOverride.length > 0 ? heroImageFits : undefined;
  const intro = introOverride?.trim() || meta.intro;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // The URL is the single source of truth for filters, sort, view and page.
  const filters = useMemo(() => parseFilters(searchParams, filterOptions), [searchParams, filterOptions]);

  const hasPricedProducts = useMemo(() => allProducts.some((p) => p.price != null && !p.priceHidden), [allProducts]);
  const uiOptions = useMemo(
    () => ({
      types: filterOptions.types,
      occasions: filterOptions.occasions,
      shapes: distinctShapes(allProducts),
      canFilterReady: allProducts.some((p) => p.inStock),
    }),
    [filterOptions, allProducts],
  );
  const canShowWorn = useMemo(() => allProducts.some((p) => p.hoverImage), [allProducts]);
  const gold = useMemo(() => goldSummary(allProducts), [allProducts]);

  // Price sorts make no sense when nothing shows a price (NAV-05).
  const sort = !hasPricedProducts && filters.sort.startsWith("price") ? "recommended" : filters.sort;
  const filtered = useMemo(
    () => sortProducts(filterProducts(allProducts, filters), sort),
    [allProducts, filters, sort],
  );
  const counts = useMemo(() => facetCounts(allProducts, filters), [allProducts, filters]);
  const quickTypes = uiOptions.types.filter((t) => (counts.types[t] ?? 0) > 0 || filters.types.includes(t));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PLP_PAGE_SIZE));
  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const currentPage = Math.min(Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam, totalPages);
  const pageProducts = filtered.slice((currentPage - 1) * PLP_PAGE_SIZE, currentPage * PLP_PAGE_SIZE);

  const [sheet, setSheet] = useState<"filter" | "sort" | null>(null);
  const closeSheet = useCallback(() => setSheet(null), [setSheet]);
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const productsTopRef = useRef<HTMLDivElement>(null);

  const hrefFor = (f: PlpFilters, page = 1) => {
    const qs = serializeFilters(f, page);
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const apply = (next: PlpFilters) => router.push(hrefFor(next), { scroll: false });

  const handlePageChange = (nextPage: number) => {
    router.push(hrefFor(filters, nextPage), { scroll: false });
    // Scroll to the top of the products list, not the page — the hero above it is tall. Offset by
    // the sticky header's measured height so the list doesn't land underneath it.
    const target = productsTopRef.current;
    if (target) {
      const headerHeight = document.querySelector(".site-header")?.getBoundingClientRect().height ?? 0;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - headerHeight, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Worn: keep the card in view where it is while every photo swaps.
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const toggleWorn = () => {
    const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
    for (const card of document.querySelectorAll<HTMLElement>(".plp-grid [data-product-id]")) {
      const rect = card.getBoundingClientRect();
      if (rect.bottom > headerBottom + 8) {
        anchor.current = { id: card.dataset.productId!, top: rect.top };
        break;
      }
    }
    router.replace(hrefFor({ ...filters, worn: !filters.worn }, currentPage), { scroll: false });
    if (!filters.worn) {
      setToast(true);
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(false), 2200);
    }
  };
  useLayoutEffect(() => {
    const held = anchor.current;
    anchor.current = null;
    if (!held) return;
    const el = document.querySelector(`.plp-grid [data-product-id="${held.id}"]`);
    if (el) window.scrollBy(0, el.getBoundingClientRect().top - held.top);
  }, [filters.worn]);

  // Back from a product: same page, same filters (they're in the URL), same scroll.
  const returned = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    // Read once — the saved visit is consumed, and effects can run twice in development.
    if (returned.current === undefined) returned.current = takePlpReturn();
    if (returned.current !== null) window.scrollTo(0, returned.current);
  }, []);

  // The filter column sticks just under the (measured) sticky header.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".site-header");
    if (!header) return;
    const measure = () =>
      document.documentElement.style.setProperty("--plp-header-h", `${header.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--plp-header-h");
    };
  }, []);

  useEffect(() => {
    document.body.classList.add("has-mobile-sticky-bar", "has-plp-bar");
    return () => {
      document.body.classList.remove("has-mobile-sticky-bar", "has-plp-bar");
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  const sortOptions = SORT_OPTIONS.filter((o) => hasPricedProducts || !o.key.startsWith("price"));
  const countLabel = filtered.length === 1 ? noun.replace(/s$/, "") : noun;

  return (
    <CartModalProvider bagCount={bagCount}>
      <PageShell {...layout}>
        <section className="plp-hero plp-hero--landing">
          <div className="plp-hero__content">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: meta.title }]} />
            <div className="plp-hero__hero-main">
              <CategoryHeroStory story={story} />
              <p className="plp-hero__intro">{intro}</p>
            </div>
          </div>
          <CategoryHeroMediaCarousel
            images={heroImages}
            label={meta.title}
            imageFits={imageFits}
            fallbackSrc={getCategoryFallbackHero(category)}
          />
        </section>

        <main className="container page-main plp-main">
          <div className="plp-layout">
            {allProducts.length > 0 && (
              <PlpFilterSidebar filters={filters} onChange={apply} products={allProducts} options={uiOptions} />
            )}

            <div className="plp-products" ref={productsTopRef}>
              {filtered.length === 0 && allProducts.length === 0 ? (
                <div className="plp-empty">
                  <h2>New {noun} are on their way</h2>
                  <p>This collection is being curated. Explore our other pieces meanwhile.</p>
                  <Link href="/all-products/rings" className="btn btn-primary">
                    Shop Rings
                  </Link>
                </div>
              ) : (
                <>
                  <div className="plp-products__head">
                    <h2 className="plp-products__title">
                      {meta.title}
                      <span className="plp-products__count plp-products__count--phone"> · {filtered.length}</span>
                      <span className="plp-products__count plp-products__count--desk">
                        {filtered.length} {countLabel}
                      </span>
                    </h2>
                    {gold && <span className="plp-products__gold plp-products__gold--phone">{gold.short}</span>}
                    <label className="plp-sort">
                      <span>Sort by</span>
                      <select
                        value={sort}
                        onChange={(e) => apply({ ...filters, sort: e.target.value as PlpFilters["sort"] })}
                        aria-label="Sort products"
                      >
                        {sortOptions.map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {quickTypes.length > 0 && (
                    <div className="plp-typechips" role="group" aria-label="Type">
                      <button
                        type="button"
                        className={`plp-chip${filters.types.length === 0 ? " is-on" : ""}`}
                        aria-pressed={filters.types.length === 0}
                        onClick={() => apply({ ...filters, types: [] })}
                      >
                        All
                      </button>
                      {quickTypes.map((t) => {
                        const on = filters.types.length === 1 && filters.types[0] === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            className={`plp-chip${on ? " is-on" : ""}`}
                            aria-pressed={on}
                            onClick={() => apply({ ...filters, types: [t] })}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {gold && <p className="plp-products__gold plp-products__gold--desk">{gold.long}</p>}

                  {filtered.length === 0 ? (
                    <div className="plp-empty plp-empty--filtered">
                      <h2>No {noun} match these filters</h2>
                      <p>Try removing a filter to see more.</p>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => apply({ ...filters, types: [], occasions: [], prices: [], shapes: [], ready: false })}
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="plp-grid">
                        {pageProducts.map((product, i) => (
                          <ProductCard
                            key={product.catalogueId}
                            product={product}
                            showActions={i < 4}
                            worn={filters.worn}
                            swipeable
                            onOpen={rememberPlpVisit}
                          />
                        ))}
                      </div>

                      <div className="plp-pagination-wrap">
                        <p className="plp-pagination__summary">
                          Showing {(currentPage - 1) * PLP_PAGE_SIZE + 1}–
                          {Math.min(currentPage * PLP_PAGE_SIZE, filtered.length)} of {filtered.length} {countLabel}
                        </p>
                        <CategoryPagination
                          page={currentPage}
                          totalPages={totalPages}
                          onPageChange={handlePageChange}
                          buildHref={(p) => hrefFor(filters, p)}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <PlpPostGridSection category={category} />
        </main>

        {toast && (
          <div className="plp-toast" role="status">
            Showing {noun} as worn
          </div>
        )}

        {allProducts.length > 0 && (
          <PlpMobileBar
            activeFilters={activeFilterCount(filters)}
            sort={sort}
            worn={filters.worn}
            canShowWorn={canShowWorn}
            noun={noun}
            onOpenFilters={() => setSheet("filter")}
            onOpenSort={() => setSheet("sort")}
            onToggleWorn={toggleWorn}
          />
        )}
        <PlpFilterSheet
          open={sheet === "filter"}
          onClose={closeSheet}
          filters={filters}
          onApply={apply}
          products={allProducts}
          options={uiOptions}
          noun={noun}
        />
        <PlpSortSheet
          open={sheet === "sort"}
          onClose={closeSheet}
          sort={sort}
          onSelect={(next) => apply({ ...filters, sort: next })}
          hasPricedProducts={hasPricedProducts}
        />
      </PageShell>
    </CartModalProvider>
  );
}
