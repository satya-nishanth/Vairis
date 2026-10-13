import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { promoSchema } from '@/lib/promo'
import { normalizeScope, replacePromoScopes } from '@/lib/discount-scope'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params

  const parsed = promoSchema.partial().safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid promo' },
      { status: 400 },
    )
  }
  const d = parsed.data

  try {
    const valueUpdate =
      d.kind === 'FREE_DELIVERY'
        ? { value: 0 }
        : d.value !== undefined
          ? { value: d.value }
          : {}
    const promo = await prisma.promoCode.update({
      where: { id },
      data: {
        ...(d.code !== undefined && { code: d.code }),
        ...(d.description !== undefined && { description: d.description || null }),
        ...(d.kind !== undefined && { kind: d.kind }),
        ...valueUpdate,
        ...(d.minOrderValue !== undefined && { minOrderValue: d.minOrderValue }),
        ...(d.maxDiscount !== undefined && { maxDiscount: d.maxDiscount }),
        ...(d.startsAt !== undefined && { startsAt: d.startsAt ? new Date(d.startsAt) : null }),
        ...(d.endsAt !== undefined && { endsAt: d.endsAt ? new Date(d.endsAt) : null }),
        ...(d.maxRedemptions !== undefined && { maxRedemptions: d.maxRedemptions }),
        ...(d.maxPerUser !== undefined && { maxPerUser: d.maxPerUser }),
        ...(d.firstOrderOnly !== undefined && { firstOrderOnly: d.firstOrderOnly }),
        ...(d.active !== undefined && { active: d.active }),
      },
    })

    if (
      d.productIds !== undefined ||
      d.collectionIds !== undefined ||
      d.storeCategoryIds !== undefined ||
      d.categories !== undefined
    ) {
      const existing = await prisma.promoCode.findUnique({
        where: { id },
        include: {
          products: { select: { productId: true } },
          collections: { select: { collectionId: true } },
          storeCategories: { select: { storeCategoryId: true } },
          categories: { select: { category: true } },
        },
      })
      await replacePromoScopes(
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

    return NextResponse.json(promo)
  } catch {
    return NextResponse.json({ error: 'Update failed (missing promo or duplicate code)' }, { status: 409 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params
  const redemptions = await prisma.promoRedemption.count({ where: { promoCodeId: id } })
  if (redemptions > 0) {
    await prisma.promoCode.update({ where: { id }, data: { active: false } })
    return NextResponse.json({ deactivated: true })
  }
  await prisma.promoCode.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
