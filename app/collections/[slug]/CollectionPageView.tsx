"use client";

import type { ReactNode } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ProductCard } from "@/components/commerce/ProductCard";
import { CartModalProvider } from "@/components/commerce/CartModal";
import { CategoryHeroMediaCarousel } from "@/components/commerce/CategoryHeroMediaCarousel";
import { useCart } from "@/components/commerce/CartProvider";
import { pageLayouts } from "@/lib/layout-config";
import type { Product } from "@/lib/ui-data";

import { PlpPostGridSection } from "@/components/commerce/PlpPostGridSection";

type Props = {
  collection: {
    slug: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    heroImages: string[];
  };
  products: Product[];
  emptyState: ReactNode;
};

export function CollectionPageView({ collection, products, emptyState }: Props) {
  const { count: bagCount } = useCart();

  return (
    <CartModalProvider bagCount={bagCount}>
      <PageShell {...pageLayouts.plp}>
        <section className="plp-hero plp-hero--landing">
          <div className="plp-hero__content">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Collections", href: "/collections" },
                { label: collection.title },
              ]}
            />
            <div className="plp-hero__hero-main">
              <h1 className="plp-hero__story">{collection.title}</h1>
              {collection.subtitle && <p className="plp-hero__story-sub">{collection.subtitle}</p>}
              {collection.description && (
                <p className="plp-hero__intro">{collection.description}</p>
              )}
            </div>
          </div>
          {collection.heroImages.length > 0 && (
            <CategoryHeroMediaCarousel images={collection.heroImages} label={collection.title} />
          )}
        </section>

        <main className="container page-main plp-main">
          {products.length === 0 ? (
            emptyState
          ) : (
            <>
              <div className="plp-grid" data-testid="collection-grid">
                {products.map((product, i) => (
                  <ProductCard
                    key={product.catalogueId}
                    product={product}
                    showActions={i < 4}
                    collectionSlug={collection.slug}
                  />
                ))}
              </div>
              <PlpPostGridSection category="rings" />
            </>
          )}
        </main>
      </PageShell>
    </CartModalProvider>
  );
}
