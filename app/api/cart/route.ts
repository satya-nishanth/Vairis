import { NextRequest, NextResponse } from 'next/server'
import { getAppUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPricingConfig, getShowPricesGlobal, resolvePriceVisibility } from '@/lib/pricing-data'
import { priceCartVariantUnit } from '@/lib/product-piece-pricing'

export const dynamic = 'force-dynamic'

const cartVariantInclude = {
  piece: true,
  product: {
    include: {
      pieces: true,
      variants: true,
      stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' as const } },
    },
  },
} as const

export async function GET() {
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [items, goldRates, pricingConfig] = await Promise.all([
    prisma.cartItem.findMany({
      where: { userId: user.id },
      include: { variant: { include: cartVariantInclude } },
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
  ])
  const rateMap = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))
  const withPrice = items.map((item) => {
    const product = item.variant.product
    const unit = priceCartVariantUnit(
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
    return {
      ...item,
      unitPrice: unit,
      priceError: unit == null ? 'Unable to price this set — check metal weights on every piece' : null,
    }
  })
  return NextResponse.json(withPrice)
}

export async function POST(req: NextRequest) {
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { variantId, quantity, withExchange = false } = await req.json()

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { product: { select: { priceVisibility: true } } },
  })
  if (!variant) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
  const showPricesGlobal = await getShowPricesGlobal()
  if (!resolvePriceVisibility(variant.product.priceVisibility, showPricesGlobal)) {
    return NextResponse.json(
      { error: 'This product is priced on request — enquire on WhatsApp' },
      { status: 403 },
    )
  }

  const item = await prisma.cartItem.upsert({
    where: {
      userId_variantId_withExchange: {
        userId: user.id,
        variantId,
        withExchange: Boolean(withExchange),
      },
    },
    update: { quantity: { increment: quantity } },
    create: {
      userId: user.id,
      variantId,
      quantity,
      withExchange: Boolean(withExchange),
    },
  })

  return NextResponse.json(item)
}
