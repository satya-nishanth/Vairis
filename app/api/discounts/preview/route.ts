import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAppUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPricingConfig } from '@/lib/pricing-data'
import { toSetOrderItemSnapshot } from '@/lib/product-piece-pricing'
import {
  loadProductScopeMembership,
  previewCartDiscounts,
  discountBasesFromSnapshot,
  type DiscountLineInput,
} from '@/lib/discounts'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  promoCode: z.string().trim().max(40).optional().nullable(),
})

/**
 * POST /api/discounts/preview — cart/checkout preview of automatic + coupon
 * reductions (separate amounts + %). Authoritative recompute happens at checkout.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'promo', 30)
  if (limited) return limited

  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const [cartItems, goldRates, pricingConfig] = await Promise.all([
    prisma.cartItem.findMany({
      where: { userId: user.id },
      include: {
        variant: {
          include: {
            piece: true,
            product: {
              include: {
                pieces: true,
                variants: true,
                stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
  ])

  if (cartItems.length === 0) {
    return NextResponse.json({
      goodsTotal: 0,
      discountAmount: 0,
      payable: 0,
      automatic: null,
      coupon: null,
    })
  }

  const rateMap = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))
  const productIds = cartItems.map((i) => i.variant.product.id)
  const membership = await loadProductScopeMembership(productIds)

  const lines: DiscountLineInput[] = []
  for (const item of cartItems) {
    const product = item.variant.product
    const snapshot = toSetOrderItemSnapshot(
      item.variant,
      product.variants,
      rateMap,
      pricingConfig,
      product.stones,
      {
        vaGoldPct: product.vaGoldPct != null ? Number(product.vaGoldPct) : null,
        vaLabel: product.vaLabel,
      },
      product.pieces.map((p) => ({
        id: p.id,
        vaGoldPct: p.vaGoldPct != null ? Number(p.vaGoldPct) : null,
        vaLabel: p.vaLabel,
      })),
      item.withExchange,
    )
    if (!snapshot) continue
    const mem = membership.get(product.id) ?? { collectionIds: [], storeCategoryIds: [] }
    lines.push({
      key: item.id,
      variantId: item.variantId,
      productId: product.id,
      category: product.category,
      collectionIds: mem.collectionIds,
      storeCategoryIds: mem.storeCategoryIds,
      quantity: item.quantity,
      ...discountBasesFromSnapshot(snapshot),
    })
  }

  const goodsTotal = lines.reduce((s, l) => s + l.unitTotal * l.quantity, 0)
  const preview = await previewCartDiscounts({
    lines,
    userId: user.id,
    promoCode: parsed.data.promoCode,
  })

  if (!preview.ok) {
    return NextResponse.json({ error: preview.reason }, { status: 422 })
  }

  const { result } = preview
  return NextResponse.json({
    goodsTotal,
    discountAmount: result.discountAmount,
    payable: Math.max(0, goodsTotal - result.discountAmount),
    automatic: result.automatic,
    coupon: result.coupon,
  })
}
