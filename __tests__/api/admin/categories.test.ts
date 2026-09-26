import { NextRequest } from "next/server";
import { GET as listCategories, POST as createCategory } from "@/app/api/admin/categories/route";
import {
  GET as getCategory,
  PATCH as updateCategory,
  DELETE as deleteCategory,
} from "@/app/api/admin/categories/[id]/route";
import { GET as getNavCategories } from "@/app/api/nav-categories/route";
import { requireAdmin } from "@/lib/auth";
import * as storeCategoriesModule from "@/lib/store-categories";

jest.mock("@/lib/auth", () => ({
  requireAdmin: jest.fn(),
}));

const mockRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;

describe("Admin Categories API & Nav Categories", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@vairis.com", role: "ADMIN" } as any);
  });

  describe("GET /api/admin/categories", () => {
    it("returns list of categories when admin is authenticated", async () => {
      const mockList = [
        {
          id: "cat_rings",
          slug: "rings",
          name: "Rings",
          description: "Rings desc",
          image: null,
          showInHeader: true,
          sortOrder: 1,
          isActive: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          productIds: [],
        },
      ];
      jest.spyOn(storeCategoriesModule, "getStoreCategories").mockResolvedValueOnce(mockList);

      const res = await listCategories();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual(mockList);
      expect(mockRequireAdmin).toHaveBeenCalled();
    });
  });

  describe("POST /api/admin/categories", () => {
    it("rejects invalid input (short name)", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: "A" }),
      });

      const res = await createCategory(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("creates a new category with showInHeader: true by default", async () => {
      const createdItem = {
        id: "cat_solitaires",
        slug: "solitaires",
        name: "Solitaires",
        description: "Classic solitaire pieces",
        image: null,
        showInHeader: true,
        sortOrder: 5,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        productIds: ["p1"],
      };

      const spyCreate = jest
        .spyOn(storeCategoriesModule, "createStoreCategory")
        .mockResolvedValueOnce(createdItem);

      const req = new NextRequest("http://localhost:3000/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({
          name: "Solitaires",
          slug: "solitaires",
          description: "Classic solitaire pieces",
          showInHeader: true,
          sortOrder: 5,
          productIds: ["p1"],
        }),
      });

      const res = await createCategory(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json).toEqual(createdItem);
      expect(spyCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Solitaires",
          slug: "solitaires",
          showInHeader: true,
        }),
      );
    });
  });

  describe("GET /api/admin/categories/[id]", () => {
    it("returns category if found", async () => {
      const item = {
        id: "cat_rings",
        slug: "rings",
        name: "Rings",
        description: null,
        image: null,
        showInHeader: true,
        sortOrder: 1,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        productIds: [],
      };
      jest.spyOn(storeCategoriesModule, "getStoreCategoryById").mockResolvedValueOnce(item);

      const req = new NextRequest("http://localhost:3000/api/admin/categories/cat_rings");
      const res = await getCategory(req, { params: Promise.resolve({ id: "cat_rings" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.name).toBe("Rings");
    });

    it("returns 404 if not found", async () => {
      jest.spyOn(storeCategoriesModule, "getStoreCategoryById").mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/admin/categories/not_exists");
      const res = await getCategory(req, { params: Promise.resolve({ id: "not_exists" }) });
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/admin/categories/[id]", () => {
    it("updates showInHeader toggle successfully", async () => {
      const updated = {
        id: "cat_rings",
        slug: "rings",
        name: "Rings",
        description: null,
        image: null,
        showInHeader: false,
        sortOrder: 1,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        productIds: [],
      };
      const spyUpdate = jest
        .spyOn(storeCategoriesModule, "updateStoreCategory")
        .mockResolvedValueOnce(updated);

      const req = new NextRequest("http://localhost:3000/api/admin/categories/cat_rings", {
        method: "PATCH",
        body: JSON.stringify({ showInHeader: false }),
      });

      const res = await updateCategory(req, { params: Promise.resolve({ id: "cat_rings" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.showInHeader).toBe(false);
      expect(spyUpdate).toHaveBeenCalledWith("cat_rings", expect.objectContaining({ showInHeader: false }));
    });
  });

  describe("DELETE /api/admin/categories/[id]", () => {
    it("deletes category and returns 204", async () => {
      jest.spyOn(storeCategoriesModule, "deleteStoreCategory").mockResolvedValueOnce(true);

      const req = new NextRequest("http://localhost:3000/api/admin/categories/cat_solitaires", {
        method: "DELETE",
      });

      const res = await deleteCategory(req, { params: Promise.resolve({ id: "cat_solitaires" }) });
      expect(res.status).toBe(204);
    });
  });

  describe("GET /api/nav-categories", () => {
    it("returns public list of categories pinned to header", async () => {
      const headerList = [
        { slug: "rings", name: "Rings" },
        { slug: "earrings", name: "Earrings" },
        { slug: "solitaires", name: "Solitaires" },
      ];
      jest.spyOn(storeCategoriesModule, "getHeaderNavCategories").mockResolvedValueOnce(headerList);

      const res = await getNavCategories();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual(headerList);
    });
  });
});
