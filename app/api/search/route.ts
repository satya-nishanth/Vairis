import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { prismaToProduct } from '@/lib/prisma-to-product'
import { getPricingConfig, getShowPricesGlobal } from '@/lib/pricing-data'

export const dynamic = 'force-dynamic'
import { rateLimit } from '@/lib/rate-limit'

/**
 * GET /api/search?q= — storefront product search (name, item code, design
 * style, description, category keyword). LIVE products only. Logs the query
 * as an analytics event (incl. zero-result queries — merchandising signal).
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 'search', 60)
  if (limited) return limited

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80)
  if (q.length < 2) return NextResponse.json({ query: q, results: [] })

  const [products, goldRates, pricingConfig, showPricesGlobal] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        status: 'LIVE',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { itemCode: { contains: q, mode: 'insensitive' } },
          { designStyle: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: {
        variants: true,
        stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
      },
      take: 12,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
    getShowPricesGlobal(),
  ])

  // Fire-and-forget analytics — never block the response.
  prisma.analyticsEvent
    .create({
      data: {
        name: 'search',
        meta: { query: q, results: products.length },
      },
    })
    .catch(() => {})

  const { autoDiscountPercentsForProducts } = await import('@/lib/auto-discount-display')
  const saleMap = await autoDiscountPercentsForProducts(products)
  return NextResponse.json({
    query: q,
    results: products.map((p, i) => {
      const ui = prismaToProduct(
        p,
        goldRates,
        i,
        pricingConfig,
        showPricesGlobal,
        saleMap.get(p.id),
      )
      return {
        id: p.id,
        name: p.name,
        itemCode: p.itemCode,
        category: ui.category,
        image: ui.image,
        price: ui.price,
        slug: ui.slug,
        autoDiscountPercent: ui.autoDiscountPercent,
        badge: ui.badge,
      }
    }),
  })
}
