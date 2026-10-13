import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/auth'
import { prismaToProduct } from '@/lib/prisma-to-product'
import { getPricingConfig, getShowPricesGlobal } from '@/lib/pricing-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [items, goldRates, pricingConfig, showPricesGlobal] = await Promise.all([
    prisma.wishlist.findMany({
      where: { userId: user.id },
      include: {
        product: {
          include: {
            variants: true,
            stones: { include: { diamondRate: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
    getShowPricesGlobal(),
  ])

  const productsForSale = items
    .map((item) => item.product)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  const { autoDiscountPercentsForProducts } = await import('@/lib/auto-discount-display')
  const saleMap = await autoDiscountPercentsForProducts(productsForSale)
  const responseItems = items.map((item, i) => ({
    id: item.id,
    userId: item.userId,
    productId: item.productId,
    createdAt: item.createdAt,
    product: item.product
      ? prismaToProduct(
          item.product,
          goldRates,
          i,
          pricingConfig,
          showPricesGlobal,
          saleMap.get(item.product.id),
        )
      : null,
  }))

  return NextResponse.json(responseItems)
}

export async function POST(req: NextRequest) {
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { productId } = await req.json()

  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  // Any active product can be wishlisted — not just coming-soon
  const product = await prisma.product.findUnique({
    where: { id: productId, isActive: true, status: 'LIVE' },
    select: { id: true },
  })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const item = await prisma.wishlist.upsert({
    where: { userId_productId: { userId: user.id, productId } },
    update: {},
    create: { userId: user.id, productId },
  })
  return NextResponse.json(item, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')

  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  await prisma.wishlist.deleteMany({ where: { userId: user.id, productId } })
  return new NextResponse(null, { status: 204 })
}
