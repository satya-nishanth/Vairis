import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  getStoreCategories,
  createStoreCategory,
} from "@/lib/store-categories";

export const dynamic = "force-dynamic";

const categorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .optional()
    .transform((s) => (s ? s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : undefined)),
  description: z.string().trim().max(1000).optional().nullable(),
  image: z.string().trim().optional().nullable(),
  showInHeader: z.boolean().default(true),
  sortOrder: z.number().int().default(10),
  productIds: z.array(z.string()).default([]),
});

export async function GET() {
  await requireAdmin();
  try {
    const categories = await getStoreCategories();
    return NextResponse.json(categories);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load categories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid category data" },
      { status: 400 },
    );
  }

  try {
    const created = await createStoreCategory(parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error("[api/admin/categories] create failed:", err);
    return NextResponse.json({ error: err?.message || "Failed to create category" }, { status: 500 });
  }
}
