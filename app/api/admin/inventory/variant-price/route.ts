import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeVariantLiveUnitPrice } from '@/lib/inventory-pricing'
import { getPricingConfig } from '@/lib/pricing-data'

export const dynamic = 'force-dynamic'

/** Live catalogue unit price for inventory form (without exchange). */
export async function GET(req: Request) {
  await requireAdmin()

  const variantId = new URL(req.url).searchParams.get('variantId')?.trim()
  if (!variantId) {
    return NextResponse.json({ error: 'variantId required' }, { status: 400 })
  }

  const [variant, goldRates, pricingConfig] = await Promise.all([
    prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          include: { stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } } },
        },
      },
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
  ])

  if (!variant) {
    return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
  }

  const rateMap = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))
  const livePrice = computeVariantLiveUnitPrice(variant, rateMap[variant.metalType], pricingConfig)

  return NextResponse.json({ livePrice })
}
