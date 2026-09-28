import { getHomeCategoryCarouselItems } from "@/lib/home-categories";
import { prisma } from "@/lib/prisma";
import * as storeCategoriesModule from "@/lib/store-categories";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
    },
  },
}));

describe("getHomeCategoryCarouselItems", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("strictly filters for isActive: true and status: 'LIVE', excluding DRAFT and AI_DRAFT", async () => {
    jest.spyOn(storeCategoriesModule, "getStoreCategories").mockResolvedValueOnce([
      {
        id: "cat_rings",
        slug: "rings",
        name: "Rings",
        description: "Bands and rings",
        image: null,
        showInHeader: true,
        sortOrder: 1,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        productIds: ["live-1", "draft-1", "ai-draft-1"],
      },
    ]);

    const mockFindMany = (prisma.product.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "live-1",
        images: ["/images/products/live-ring-1.jpg"],
        priority: 10,
      },
    ]);

    const items = await getHomeCategoryCarouselItems();

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          status: "LIVE", // Strictly LIVE
        }),
      }),
    );

    // Verify where clause specifically contains the id in check and status LIVE
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.status).toBe("LIVE");
    expect(whereArg.isActive).toBe(true);

    expect(items).toHaveLength(1);
    expect(items[0].slug).toBe("rings");
    expect(items[0].images).toEqual(["/images/products/live-ring-1.jpg"]);
  });

  it("does not include products in DRAFT or AI_DRAFT even if present in the database", async () => {
    jest.spyOn(storeCategoriesModule, "getStoreCategories").mockResolvedValueOnce([
      {
        id: "cat_earrings",
        slug: "earrings",
        name: "Earrings",
        description: "Studs and drops",
        image: null,
        showInHeader: true,
        sortOrder: 2,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        productIds: [],
      },
    ]);

    // When query with status: 'LIVE' is made, DB returns only the live products
    (prisma.product.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "live-earring",
        images: ["/images/products/live-earring.jpg"],
        priority: 5,
      },
    ]);

    const items = await getHomeCategoryCarouselItems();

    const whereArg = (prisma.product.findMany as jest.Mock).mock.calls[0][0].where;
    expect(whereArg.status).toBe("LIVE");
    expect(whereArg.isActive).toBe(true);
    expect(items[0].images).toEqual(["/images/products/live-earring.jpg"]);
  });
});
