import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { prismaToProduct } from '@/lib/prisma-to-product'
import { getPricingConfig, getShowPricesGlobal } from '@/lib/pricing-data'
import { rateLimit } from '@/lib/rate-limit'
import { SLUG_TO_PRISMA, type PrismaCategory } from '@/lib/categories'
import { getAllCategoryFilters } from '@/lib/category-filters'

export const dynamic = 'force-dynamic'

/**
 * GET /api/search?q= — storefront product search (name, item code, design
 * style, description, category keyword, and linked filter labels). LIVE products only.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 'search', 60)
  if (limited) return limited

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80)
  if (q.length < 2) return NextResponse.json({ query: q, results: [] })

  const qLower = q.toLowerCase()

  // Match category enum by query keywords (e.g. "rings", "ring", "earrings", "earring", "bracelet")
  const matchingCategories: PrismaCategory[] = []
  for (const [slug, prismaCat] of Object.entries(SLUG_TO_PRISMA)) {
    const singular = slug.replace(/s$/, '')
    if (slug.includes(qLower) || qLower.includes(slug) || qLower.includes(singular)) {
      matchingCategories.push(prismaCat)
    }
  }

  // Match products linked to category filter labels (e.g. "Studs", "Solitaire", "Everyday Wear")
  const allFilters = await getAllCategoryFilters().catch(() => ({}))
  const matchedProductIdsFromLabels = new Set<string>()
  for (const config of Object.values(allFilters)) {
    if (!config?.labelProductMap) continue
    for (const [label, productIds] of Object.entries(config.labelProductMap)) {
      if (label.toLowerCase().includes(qLower) && Array.isArray(productIds)) {
        for (const id of productIds) {
          matchedProductIdsFromLabels.add(id)
        }
      }
    }
  }

  const orConditions: any[] = [
    { name: { contains: q, mode: 'insensitive' } },
    { itemCode: { contains: q, mode: 'insensitive' } },
    { designStyle: { contains: q, mode: 'insensitive' } },
    { description: { contains: q, mode: 'insensitive' } },
  ]

  if (matchingCategories.length > 0) {
    orConditions.push({ category: { in: matchingCategories } })
  }
  if (matchedProductIdsFromLabels.size > 0) {
    orConditions.push({ id: { in: Array.from(matchedProductIdsFromLabels) } })
  }

  const [products, goldRates, pricingConfig, showPricesGlobal] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        status: 'LIVE',
        OR: orConditions,
      },
      include: {
        variants: true,
        stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
      },
      take: 20,
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
