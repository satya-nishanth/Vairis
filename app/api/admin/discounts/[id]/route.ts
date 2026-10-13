import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { automaticDiscountSchema } from '@/app/api/admin/discounts/route'
import { normalizeScope, replaceAutomaticDiscountScopes } from '@/lib/discount-scope'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params
  const parsed = automaticDiscountSchema.partial().safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid discount' },
      { status: 400 },
    )
  }
  const d = parsed.data

  try {
    const row = await prisma.automaticDiscount.update({
      where: { id },
      data: {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.displayName !== undefined && { displayName: d.displayName }),
        ...(d.percent !== undefined && { percent: d.percent }),
        ...(d.maxDiscount !== undefined && { maxDiscount: d.maxDiscount }),
        ...(d.startsAt !== undefined && { startsAt: d.startsAt ? new Date(d.startsAt) : null }),
        ...(d.endsAt !== undefined && { endsAt: d.endsAt ? new Date(d.endsAt) : null }),
        ...(d.priority !== undefined && { priority: d.priority }),
        ...(d.active !== undefined && { active: d.active }),
      },
    })

    if (
      d.productIds !== undefined ||
      d.collectionIds !== undefined ||
      d.storeCategoryIds !== undefined ||
      d.categories !== undefined
    ) {
      const existing = await prisma.automaticDiscount.findUnique({
        where: { id },
        include: {
          products: { select: { productId: true } },
          collections: { select: { collectionId: true } },
          storeCategories: { select: { storeCategoryId: true } },
          categories: { select: { category: true } },
        },
      })
      await replaceAutomaticDiscountScopes(
        id,
        normalizeScope({
          productIds: d.productIds ?? existing?.products.map((x) => x.productId) ?? [],
          collectionIds: d.collectionIds ?? existing?.collections.map((x) => x.collectionId) ?? [],
          storeCategoryIds:
            d.storeCategoryIds ?? existing?.storeCategories.map((x) => x.storeCategoryId) ?? [],
          categories: d.categories ?? existing?.categories.map((x) => x.category) ?? [],
        }),
      )
    }

    return NextResponse.json(row)
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 404 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params
  await prisma.automaticDiscount.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
