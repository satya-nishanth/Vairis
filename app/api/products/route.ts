import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Category } from '@prisma/client'
import { sortProductsByPriority } from '@/lib/product-priorities'
import { prismaToProduct } from '@/lib/prisma-to-product'
import { getPricingConfig, getShowPricesGlobal } from '@/lib/pricing-data'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const ids = searchParams.get('ids')

  // ids lookup (e.g. resolving a guest's localStorage wishlist to real
  // product data) intentionally skips the isActive/LIVE filter — the caller
  // already knows which specific products it wants, and this must match
  // what GET /api/wishlist shows a logged-in user for the same ids.
  const idList = ids ? ids.split(',').map((s) => s.trim()).filter(Boolean) : null

  const [products, goldRates, pricingConfig, showPricesGlobal] = await Promise.all([
    prisma.product.findMany({
      where: idList
        ? { id: { in: idList } }
        : {
            isActive: true,
            status: 'LIVE',
            ...(category ? { category: category as Category } : {}),
            ...(search
              ? {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { itemCode: { contains: search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
      orderBy: { name: 'asc' },
      include: {
        variants: true,
        stones: { include: { diamondRate: true } },
      },
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
    getShowPricesGlobal(),
  ])

  const sorted = sortProductsByPriority(products)
  const { autoDiscountPercentsForProducts } = await import('@/lib/auto-discount-display')
  const saleMap = await autoDiscountPercentsForProducts(sorted)
  const items = sorted.map((p, i) =>
    prismaToProduct(p, goldRates, i, pricingConfig, showPricesGlobal, saleMap.get(p.id)),
  )

  return NextResponse.json(items)
}
