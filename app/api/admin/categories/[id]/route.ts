import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  getStoreCategoryById,
  updateStoreCategory,
  deleteStoreCategory,
} from "@/lib/store-categories";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .transform((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  image: z.string().trim().nullable().optional(),
  showInHeader: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  productIds: z.array(z.string()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const category = await getStoreCategoryById(id);
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  return NextResponse.json(category);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid category data" },
      { status: 400 },
    );
  }

  try {
    const updated = await updateStoreCategory(id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("[api/admin/categories/[id]] patch failed:", err);
    return NextResponse.json({ error: err?.message || "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  try {
    const success = await deleteStoreCategory(id);
    if (!success) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error("[api/admin/categories/[id]] delete failed:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete category" },
      { status: 500 },
    );
  }
}
