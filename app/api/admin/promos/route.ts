import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { promoSchema } from '@/lib/promo'
import { normalizeScope, promoScopeInclude, replacePromoScopes } from '@/lib/discount-scope'

export const dynamic = 'force-dynamic'

export async function GET() {
  await requireAdmin()
  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { redemptions: true } }, ...promoScopeInclude },
  })
  return NextResponse.json(
    promos.map((p) => ({
      ...p,
      value: Number(p.value),
      minOrderValue: Number(p.minOrderValue),
      maxDiscount: p.maxDiscount != null ? Number(p.maxDiscount) : null,
      redemptionCount: p._count.redemptions,
      productIds: p.products.map((x) => x.productId),
      collectionIds: p.collections.map((x) => x.collectionId),
      storeCategoryIds: p.storeCategories.map((x) => x.storeCategoryId),
      categories: p.categories.map((x) => x.category),
    })),
  )
}

export async function POST(req: NextRequest) {
  await requireAdmin()
  const parsed = promoSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid promo' },
      { status: 400 },
    )
  }
  const d = parsed.data
  const scope = normalizeScope(d)
  try {
    const promo = await prisma.promoCode.create({
      data: {
        code: d.code,
        description: d.description || null,
        kind: d.kind,
        value: d.kind === 'FREE_DELIVERY' ? 0 : d.value,
        minOrderValue: d.minOrderValue,
        maxDiscount: d.maxDiscount,
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
        maxRedemptions: d.maxRedemptions,
        maxPerUser: d.maxPerUser,
        firstOrderOnly: d.firstOrderOnly,
        active: d.active,
      },
    })
    await replacePromoScopes(promo.id, scope)
    return NextResponse.json(promo, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'A promo with this code already exists' }, { status: 409 })
  }
}
