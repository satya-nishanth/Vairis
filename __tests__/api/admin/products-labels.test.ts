/**
 * @jest-environment node
 */
import { GET, POST } from "@/app/api/admin/products/[id]/labels/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import * as categoryFilters from "@/lib/category-filters";

jest.mock("@/lib/auth", () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: "admin1", role: "ADMIN" }),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findUnique: jest.fn() },
    productTag: { findMany: jest.fn() },
    categoryFilterConfig: { findUnique: jest.fn() },
  },
}));

const config = {
  categorySlug: "rings",
  categoryName: "Rings",
  types: ["Solitaire", "Stackable", "Halo"],
  occasions: ["Gifting"],
  labels: ["Solitaire", "Stackable", "Halo", "Gifting"],
  labelProductMap: {},
  updatedAt: "2026-09-28T00:00:00.000Z",
};

describe("/api/admin/products/[id]/labels route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET returns the product's tags and the category's available labels", async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "prod_1",
      category: "RINGS",
      tags: [
        { group: "OCCASION", value: "Gifting" },
        { group: "TYPE", value: "Solitaire" },
      ],
    });
    (prisma.categoryFilterConfig.findUnique as jest.Mock).mockResolvedValueOnce({
      categorySlug: "rings",
      categoryName: "Rings",
      types: config.types,
      occasions: config.occasions,
      updatedAt: new Date("2026-09-28"),
    });

    const req = new NextRequest("http://localhost/api/admin/products/prod_1/labels");
    const res = await GET(req, { params: Promise.resolve({ id: "prod_1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.productId).toBe("prod_1");
    expect(json.labels).toEqual(["Solitaire", "Gifting"]);
    expect(json.availableLabels).toEqual(config.labels);
  });

  it("POST replaces the product's labels via setProductLabels", async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValueOnce({ id: "prod_1", category: "RINGS" });
    (prisma.productTag.findMany as jest.Mock).mockResolvedValueOnce([{ group: "TYPE", value: "Halo" }]);
    const setSpy = jest.spyOn(categoryFilters, "setProductLabels").mockResolvedValueOnce(config);

    const req = new NextRequest("http://localhost/api/admin/products/prod_1/labels", {
      method: "POST",
      body: JSON.stringify({ labels: ["Halo"] }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "prod_1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(setSpy).toHaveBeenCalledWith("prod_1", "rings", ["Halo"]);
    expect(json.labels).toEqual(["Halo"]);
  });
});
