"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { ProductCard } from "@/components/commerce/ProductCard";
import { useWishlist } from "@/components/commerce/WishlistProvider";
import { useCart } from "@/components/commerce/CartProvider";
import { CartModalProvider } from "@/components/commerce/CartModal";
import { pageLayouts } from "@/lib/layout-config";
import { categoryHref } from "@/lib/catalogue-ui";
import { prismaCategoryToSlug } from "@/lib/categories";
import type { Product } from "@/lib/ui-data";

type ApiProduct = Product & {
  id?: string;
};

function toProduct(p: any, i: number): Product {
  if (p && p.slug && p.image !== undefined && p.catalogueId) {
    return p;
  }
  return {
    slug: p.id ?? p.slug,
    sku: p.sku ?? p.id,
    name: p.name,
    image: p.image ?? p.images?.[0] ?? "",
    images: p.images ?? [],
    category: typeof p.category === "string" ? prismaCategoryToSlug(p.category) : p.category,
    catalogueId: p.catalogueId ?? p.id,
    video: null,
    badge: i === 0 ? "Best Seller" : undefined,
    meta: "Insured Delivery",
    price: p.price,
    variantId: p.variantId,
    priceHidden: p.priceHidden,
    hasMultiplePrices: p.hasMultiplePrices,
  };
}

export function WishlistPageView() {
  const layout = pageLayouts.wishlist;
  const { ids, count, isLoggedIn } = useWishlist();
  const { count: cartCount } = useCart();
  const [apiProducts, setApiProducts] = useState<Product[] | null>(null);
  const [guestCache, setGuestCache] = useState<Map<string, Product>>(new Map());

  // Logged-in path: fetch server wishlist items
  useEffect(() => {
    if (!isLoggedIn) return;
    let active = true;
    fetch("/api/wishlist")
      .then(async (res) => {
        if (!res.ok || !active) return;
        const items = (await res.json()) as { product: any }[];
        const valid = items
          .filter((item) => Boolean(item.product))
          .map((item, i) => toProduct(item.product, i));
        setApiProducts(valid);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isLoggedIn]);

  // Guest / local fallback path: resolve product metadata for any missing IDs
  useEffect(() => {
    const missing = [...ids].filter((id) => !guestCache.has(id));
    if (missing.length === 0) return;
    fetch(`/api/products?ids=${missing.join(",")}`)
      .then(async (res) => {
        if (!res.ok) return;
        const items = (await res.json()) as any[];
        setGuestCache((prev) => {
          const next = new Map(prev);
          items.forEach((p, i) => next.set(p.catalogueId || p.slug || p.id, toProduct(p, i)));
          return next;
        });
      })
      .catch(() => {});
  }, [ids, guestCache]);

  const guestResolved = [...ids].every((id) => guestCache.has(id));

  // Merge server products and local cache to guarantee every wishlisted item is displayed
  const products: Product[] = useMemo(() => {
    const map = new Map<string, Product>();
    if (isLoggedIn && apiProducts) {
      for (const p of apiProducts) {
        if (ids.has(p.catalogueId)) {
          map.set(p.catalogueId, p);
        }
      }
    }
    for (const id of ids) {
      if (!map.has(id) && guestCache.has(id)) {
        map.set(id, guestCache.get(id)!);
      }
    }
    return Array.from(map.values());
  }, [isLoggedIn, apiProducts, ids, guestCache]);

  const loading = ids.size > 0 && products.length === 0 && (isLoggedIn ? apiProducts === null : !guestResolved);

  return (
    <CartModalProvider bagCount={cartCount}>
      <PageShell
        {...layout}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Wishlist" },
        ]}
      >
        <main>
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
                <Button href={categoryHref("rings")} variant="primary">
                  Shop Rings
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
                <Link href={categoryHref("rings")}>Continue shopping</Link>
              </p>
            )}
          </div>
        </Container>
        </main>
      </PageShell>
    </CartModalProvider>
  );
}
