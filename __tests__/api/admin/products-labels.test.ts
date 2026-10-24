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
    product: {
      findUnique: jest.fn(),
    },
  },
}));

describe("/api/admin/products/[id]/labels route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET returns current labels and available category labels", async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "prod_1",
      name: "Solitaire Engagement Ring",
      itemCode: "VR-R01",
      category: "RINGS",
      designStyle: "Solitaire",
      description: "Classic band",
    });

    jest.spyOn(categoryFilters, "getAllCategoryFilters").mockResolvedValueOnce({
      rings: {
        categorySlug: "rings",
        categoryName: "Rings",
        labels: ["Solitaire", "Cocktail", "Stackable"],
        metals: ["Yellow Gold"],
        labelProductMap: {},
        updatedAt: "2026-09-28T00:00:00.000Z",
      },
    });

    const req = new NextRequest("http://localhost/api/admin/products/prod_1/labels");
    const res = await GET(req, { params: Promise.resolve({ id: "prod_1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.productId).toBe("prod_1");
    expect(json.labels).toContain("Solitaire");
    expect(json.availableLabels).toEqual(["Solitaire", "Cocktail", "Stackable"]);
  });

  it("POST updates product labels via setProductLabels", async () => {
    const mockProduct = {
      id: "prod_1",
      name: "Solitaire Engagement Ring",
      itemCode: "VR-R01",
      category: "RINGS",
      designStyle: "Solitaire",
      description: "Classic band",
    };

    (prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(mockProduct);

    const setSpy = jest.spyOn(categoryFilters, "setProductLabels").mockResolvedValueOnce({
      categorySlug: "rings",
      categoryName: "Rings",
      labels: ["Solitaire", "Cocktail", "Stackable", "Halo"],
      metals: ["Yellow Gold"],
      labelProductMap: {
        Halo: ["prod_1"],
      },
      labelExcludedMap: {
        Solitaire: ["prod_1"],
      },
      updatedAt: "2026-09-28T00:00:00.000Z",
    });

    const req = new NextRequest("http://localhost/api/admin/products/prod_1/labels", {
      method: "POST",
      body: JSON.stringify({ labels: ["Halo"] }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "prod_1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(setSpy).toHaveBeenCalledWith("prod_1", "rings", ["Halo"], mockProduct);
    expect(json.labels).toContain("Halo");
    expect(json.labels).not.toContain("Solitaire");
  });
});
