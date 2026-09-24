import { NextResponse } from "next/server";
import { getHeaderNavCategories } from "@/lib/store-categories";

export const dynamic = "force-dynamic";

/** Categories pinned to the storefront navigation header (showInHeader: true). */
export async function GET() {
  try {
    const categories = await getHeaderNavCategories();
    return NextResponse.json(categories, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[api/nav-categories] failed:", err);
    return NextResponse.json([], { status: 200 });
  }
}
