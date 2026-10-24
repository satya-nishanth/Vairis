/**
 * @jest-environment node
 */
import { GET, POST, DELETE } from "@/app/api/admin/filters/route";
import { NextRequest } from "next/server";
import * as categoryFilters from "@/lib/category-filters";
import * as auth from "@/lib/auth";

jest.mock("@/lib/auth", () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: "admin1", role: "ADMIN" }),
}));

describe("/api/admin/filters route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET returns all category filters", async () => {
    jest.spyOn(categoryFilters, "getAllCategoryFilters").mockResolvedValueOnce({
      rings: {
        categorySlug: "rings",
        categoryName: "Rings",
        types: ["Solitaire", "Cocktail"],
        occasions: ["Gifting"],
        labels: ["Solitaire", "Cocktail", "Gifting"],
        labelProductMap: {},
        updatedAt: "2026-09-28T00:00:00.000Z",
      },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.rings.types).toContain("Cocktail");
  });

  it("POST saves updated category labels", async () => {
    const spy = jest.spyOn(categoryFilters, "saveCategoryFilters").mockResolvedValueOnce({
      categorySlug: "rings",
      categoryName: "Rings",
      types: ["Solitaire", "Halo", "Vintage"],
      occasions: ["Gifting"],
      labels: ["Solitaire", "Halo", "Vintage", "Gifting"],
      labelProductMap: { Halo: ["p1"] },
      updatedAt: "2026-09-28T00:00:00.000Z",
    });

    const req = new NextRequest("http://localhost/api/admin/filters", {
      method: "POST",
      body: JSON.stringify({
        slug: "rings",
        types: ["Solitaire", "Halo", "Vintage"],
        occasions: ["Gifting"],
        labelProductMap: { Halo: ["p1"] },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith("rings", {
      types: ["Solitaire", "Halo", "Vintage"],
      occasions: ["Gifting"],
      labelProductMap: { Halo: ["p1"] },
      categoryName: undefined,
    });
  });

  it("DELETE resets category filters", async () => {
    const spy = jest.spyOn(categoryFilters, "resetCategoryFilters").mockResolvedValueOnce({
      categorySlug: "rings",
      categoryName: "Rings",
      types: ["Solitaire", "Stackable"],
      occasions: [],
      labels: ["Solitaire", "Stackable"],
      labelProductMap: {},
      updatedAt: "2026-09-28T00:00:00.000Z",
    });

    const req = new NextRequest("http://localhost/api/admin/filters?slug=rings", {
      method: "DELETE",
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith("rings");
  });
});
