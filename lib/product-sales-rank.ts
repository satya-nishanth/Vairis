import { unstable_cache } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const WINDOW_DAYS = 180;
const NEW_DAYS = 60;
const BESTSELLER_COUNT = 3;
const BESTSELLER_MIN_UNITS = 2;

/** Orders that count as a sale: paid and not cancelled, expired, returned or refunded. */
const SOLD_STATUSES: OrderStatus[] = [
  "PAYMENT_CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "SPLIT_INTO_DELIVERIES",
  "DEPOSIT_REFUNDED",
];

/** Units sold per product id over the last 180 days. Cached for 10 minutes. */
export const getProductSalesUnits = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
    const items = await prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: since }, status: { in: SOLD_STATUSES } } },
      select: { quantity: true, variant: { select: { productId: true } } },
    });
    const units: Record<string, number> = {};
    for (const { quantity, variant } of items) {
      units[variant.productId] = (units[variant.productId] ?? 0) + quantity;
    }
    return units;
  },
  ["plp-sales-units"],
  { revalidate: 600, tags: ["sales-rank"] },
);

type Rankable = { slug: string; badge?: string; salesRank?: number | null };

/** Adds salesRank (units sold) and the Best Seller badge on the category's top sellers. */
export function applySalesRank<T extends Rankable>(products: T[], units: Record<string, number>): T[] {
  const top = new Set(
    products
      .filter((p) => (units[p.slug] ?? 0) >= BESTSELLER_MIN_UNITS)
      .sort((a, b) => units[b.slug] - units[a.slug])
      .slice(0, BESTSELLER_COUNT)
      .map((p) => p.slug),
  );
  return products.map((p) => ({
    ...p,
    salesRank: units[p.slug] ?? null,
    badge: p.badge ?? (top.has(p.slug) ? "Best Seller" : undefined),
  }));
}

/**
 * Recommended order for DB products: admin priority first (0, 1, 2…), then
 * bestsellers, then designs from the last 60 days, then name.
 */
export function sortRecommended<T extends { id: string; name: string; priority: number; createdAt: Date }>(
  products: T[],
  units: Record<string, number>,
  now = Date.now(),
): T[] {
  const isNew = (p: T) => now - p.createdAt.getTime() < NEW_DAYS * 86_400_000;
  return [...products].sort(
    (a, b) =>
      a.priority - b.priority ||
      (units[b.id] ?? 0) - (units[a.id] ?? 0) ||
      Number(isNew(b)) - Number(isNew(a)) ||
      a.name.localeCompare(b.name),
  );
}
