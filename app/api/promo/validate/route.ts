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
import { validatePromo } from '@/lib/promo'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  code: z.string().trim().min(1).max(40),
  /** Used when the session cart is empty (legacy preview). */
  cartTotal: z.number().nonnegative().optional(),
})

/**
 * POST /api/promo/validate — cart-time coupon preview (plus automatic leg when cart loaded).
 * Prefer /api/discounts/preview for full breakdown. Final check re-runs at checkout.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'promo', 20)
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
    const cartTotal = parsed.data.cartTotal ?? 0
    const result = await validatePromo(parsed.data.code, user.id, cartTotal)
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 422 })
    return NextResponse.json({
      code: result.promo.code,
      description: result.promo.description,
      discount: result.discount,
      automatic: null,
      coupon: {
        id: result.promo.id,
        code: result.promo.code,
        kind: result.promo.kind,
        amount: result.discount,
        percent:
          result.promo.kind === 'PERCENT' || result.promo.kind === 'MAKING_PERCENT'
            ? Number(result.promo.value)
            : undefined,
      },
      discountAmount: result.discount,
    })
  }

  const rateMap = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))
  const membership = await loadProductScopeMembership(cartItems.map((i) => i.variant.product.id))

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

  const preview = await previewCartDiscounts({
    lines,
    userId: user.id,
    promoCode: parsed.data.code,
  })
  if (!preview.ok) return NextResponse.json({ error: preview.reason }, { status: 422 })

  const { result } = preview
  return NextResponse.json({
    code: result.coupon?.code ?? parsed.data.code.toUpperCase(),
    description: null,
    discount: result.coupon?.amount ?? 0,
    automatic: result.automatic,
    coupon: result.coupon,
    discountAmount: result.discountAmount,
  })
}
