jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
jest.mock("@/lib/prisma", () => ({ prisma: { orderItem: { findMany: jest.fn() } } }));

import { prisma } from "@/lib/prisma";
import { applySalesRank, getProductSalesUnits, sortRecommended } from "@/lib/product-sales-rank";

const NOW = Date.parse("2026-10-23T00:00:00Z");
const row = (id: string, name: string, priority = 0, daysOld = 400) => ({
  id,
  name,
  priority,
  createdAt: new Date(NOW - daysOld * 86_400_000),
});

describe("product sales rank", () => {
  it("sums units per product for paid orders", async () => {
    (prisma.orderItem.findMany as jest.Mock).mockResolvedValueOnce([
      { quantity: 2, variant: { productId: "a" } },
      { quantity: 1, variant: { productId: "a" } },
      { quantity: 4, variant: { productId: "b" } },
    ]);
    await expect(getProductSalesUnits()).resolves.toEqual({ a: 3, b: 4 });
    const where = (prisma.orderItem.findMany as jest.Mock).mock.calls[0][0].where.order;
    expect(where.status.in).toContain("DELIVERED");
    expect(where.status.in).not.toContain("CANCELLED");
    expect(where.status.in).not.toContain("PAYMENT_PENDING");
  });

  it("orders by priority, then units sold, then new designs, then name", () => {
    const rows = [
      row("plain", "Plain"),
      row("fresh", "Fresh", 0, 10),
      row("best", "Best"),
      row("pinned", "Zed", -1),
      row("pri2", "Aaa", 2),
    ];
    const ids = sortRecommended(rows, { best: 9, plain: 1 }, NOW).map((p) => p.id);
    expect(ids).toEqual(["pinned", "best", "plain", "fresh", "pri2"]);
  });

  it("badges the top 3 sellers (with 2+ units), keeping any other badge", () => {
    const list = ["a", "b", "c", "d", "e"].map((slug) => ({ slug, badge: slug === "a" ? "10% off" : undefined }));
    const out = applySalesRank(list, { a: 50, b: 9, c: 5, d: 3, e: 1 });
    expect(out.map((p) => p.badge)).toEqual(["10% off", "Best Seller", "Best Seller", undefined, undefined]);
    expect(out.map((p) => p.salesRank)).toEqual([50, 9, 5, 3, 1]);
    expect(applySalesRank([{ slug: "z" }], {})[0]).toEqual({ slug: "z", salesRank: null, badge: undefined });
  });
});
