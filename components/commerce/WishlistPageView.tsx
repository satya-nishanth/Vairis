"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { ProductCard } from "@/components/commerce/ProductCard";
import { useWishlist } from "@/components/commerce/WishlistProvider";
import { pageLayouts } from "@/lib/layout-config";
import { catalogueProducts, categoryHref } from "@/lib/catalogue-ui";
import { catalogueToProduct } from "@/lib/ui-data";
import type { Product } from "@/lib/ui-data";

type WishlistApiItem = {
  productId: string;
  product: {
    id: string;
    name: string;
    category: string;
    images: string[];
  };
};

const PRISMA_TO_CATEGORY: Record<string, string> = {
  RINGS: "rings",
  EARRINGS: "earrings",
  PENDANTS: "pendants",
  BRACELETS: "bracelets",
  NECKLACES: "necklaces",
};

export function WishlistPageView() {
  const layout = pageLayouts.wishlist;
  const { ids, count } = useWishlist();
  const [apiProducts, setApiProducts] = useState<Product[] | null>(null);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    fetch("/api/wishlist")
      .then(async (res) => {
        if (!res.ok) return;
        const items = (await res.json()) as WishlistApiItem[];
        if (items.length === 0) {
          setApiProducts([]);
          return;
        }
        const mapped: Product[] = items.map((item, i) => ({
          slug: item.product.id,
          sku: item.product.id,
          name: item.product.name,
          image: item.product.images[0] ?? "",
          images: item.product.images,
          category:
            (PRISMA_TO_CATEGORY[item.product.category] as Product["category"]) ??
            "other",
          catalogueId: item.product.id,
          video: null,
          badge: i === 0 ? "Best Seller" : undefined,
          meta: "Insured Delivery",
        }));
        setApiProducts(mapped);
      })
      .catch(() => {
        /* logged-out or network error — fall through to catalogue lookup */
      })
      .finally(() => setFetched(true));
  }, []);

  // When logged in, use API-fetched products. When not logged in, look up catalogue.
  const products: Product[] =
    apiProducts ??
    catalogueProducts
      .filter((p) => ids.has(p.id) || ids.has(p.slug))
      .map((item, i) => catalogueToProduct(item, i));

  const loading = !fetched && apiProducts === null;

  return (
    <PageShell
      {...layout}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Wishlist" },
      ]}
    >
      <Container>
        <div className="wishlist-page">
          <h1 className="wishlist-page__title">Wishlist ({count})</h1>
          <p className="wishlist-page__lead">
            Pieces you&apos;ve saved for later — insured delivery on every
            order.
          </p>

          {loading ? null : products.length === 0 ? (
            <div className="wishlist-empty">
              <p>
                Your wishlist is empty. Explore our collections and tap the
                heart on pieces you love.
              </p>
              <Button href={categoryHref("necklaces")} variant="primary">
                Shop necklaces
              </Button>
            </div>
          ) : (
            <div className="wishlist-grid">
              {products.map((product) => (
                <ProductCard key={product.catalogueId} product={product} />
              ))}
            </div>
          )}

          {products.length > 0 && (
            <p style={{ marginTop: 32, fontSize: "0.875rem" }}>
              <Link href="/cart">View cart</Link>
              {" · "}
              <Link href={categoryHref("earrings")}>Continue shopping</Link>
            </p>
          )}
        </div>
      </Container>
    </PageShell>
  );
}
