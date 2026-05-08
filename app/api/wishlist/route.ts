import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await requireUser()
  const items = await prisma.wishlist.findMany({
    where: { userId: user.id },
    include: {
      product: {
        select: { id: true, name: true, category: true, images: true, comingSoon: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const user = await requireUser()
  const { productId } = await req.json()

  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  // Any active product can be wishlisted — not just coming-soon
  const product = await prisma.product.findUnique({
    where: { id: productId, isActive: true },
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
  const user = await requireUser()
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')

  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  await prisma.wishlist.deleteMany({ where: { userId: user.id, productId } })
  return new NextResponse(null, { status: 204 })
}
