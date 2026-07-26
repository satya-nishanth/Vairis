"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { ProductCard } from "@/components/commerce/ProductCard";
import { useWishlist } from "@/components/commerce/WishlistProvider";
import { pageLayouts } from "@/lib/layout-config";
import { categoryHref } from "@/lib/catalogue-ui";
import { prismaCategoryToSlug } from "@/lib/categories";
import type { Product } from "@/lib/ui-data";

type ApiProduct = {
  id: string;
  name: string;
  category: string;
  images: string[];
};

function toProduct(p: ApiProduct, i: number): Product {
  return {
    slug: p.id,
    sku: p.id,
    name: p.name,
    image: p.images[0] ?? "",
    images: p.images,
    category: prismaCategoryToSlug(p.category),
    catalogueId: p.id,
    video: null,
    badge: i === 0 ? "Best Seller" : undefined,
    meta: "Insured Delivery",
  };
}

export function WishlistPageView() {
  const layout = pageLayouts.wishlist;
  const { ids, count } = useWishlist();
  const [apiProducts, setApiProducts] = useState<Product[] | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  // Guest path: caches every id we've resolved so far, keyed by id — the
  // visible list is *derived* from this cache filtered by the current live
  // `ids` set, so removing an item drops it immediately without needing a
  // separate "clear" write when `ids` shrinks.
  const [guestCache, setGuestCache] = useState<Map<string, Product>>(new Map());

  useEffect(() => {
    fetch("/api/wishlist")
      .then(async (res) => {
        setLoggedIn(res.ok);
        if (!res.ok) return;
        const items = (await res.json()) as { product: ApiProduct }[];
        setApiProducts(items.map((item, i) => toProduct(item.product, i)));
      })
      .catch(() => setLoggedIn(false));
  }, []);

  // Guest path: localStorage only holds product ids — resolve any not
  // already cached against the real catalogue once WishlistProvider has
  // hydrated `ids` and we know there's no server session to defer to.
  useEffect(() => {
    if (loggedIn !== false) return;
    const missing = [...ids].filter((id) => !guestCache.has(id));
    if (missing.length === 0) return;
    fetch(`/api/products?ids=${missing.join(",")}`)
      .then(async (res) => {
        if (!res.ok) return;
        const items = (await res.json()) as ApiProduct[];
        setGuestCache((prev) => {
          const next = new Map(prev);
          items.forEach((p, i) => next.set(p.id, toProduct(p, i)));
          return next;
        });
      })
      .catch(() => {});
  }, [loggedIn, ids, guestCache]);

  const guestResolved = [...ids].every((id) => guestCache.has(id));
  const guestProducts = [...ids].map((id) => guestCache.get(id)).filter((p): p is Product => !!p);
  const products: Product[] = apiProducts ?? guestProducts;
  const loading = loggedIn === null || (loggedIn === false && !guestResolved);

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
