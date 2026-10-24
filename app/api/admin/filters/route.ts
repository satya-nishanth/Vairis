import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  getAllCategoryFilters,
  saveCategoryFilters,
  resetCategoryFilters,
} from "@/lib/category-filters";

export const dynamic = "force-dynamic";

const filterSaveSchema = z.object({
  slug: z.string().trim().min(1, "Category slug is required"),
  types: z.array(z.string().trim()).default([]),
  occasions: z.array(z.string().trim()).default([]),
  labelProductMap: z.record(z.string(), z.array(z.string())).optional(),
  categoryName: z.string().trim().optional(),
});

export async function GET() {
  await requireAdmin();
  try {
    const filters = await getAllCategoryFilters();
    return NextResponse.json({ ok: true, data: filters });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load category filters" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const parsed = filterSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid filter payload" },
      { status: 400 }
    );
  }

  try {
    const saved = await saveCategoryFilters(parsed.data.slug, {
      types: parsed.data.types,
      occasions: parsed.data.occasions,
      labelProductMap: parsed.data.labelProductMap,
      categoryName: parsed.data.categoryName,
    });
    return NextResponse.json({ ok: true, data: saved });
  } catch (err: any) {
    console.error("[api/admin/filters] Failed saving filters:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to save category filters" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug query parameter" }, { status: 400 });
  }

  try {
    const reset = await resetCategoryFilters(slug);
    return NextResponse.json({ ok: true, data: reset });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to reset category filters" },
      { status: 500 }
    );
  }
}
