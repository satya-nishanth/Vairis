import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
import { rateLimit } from '@/lib/rate-limit'

type Params = Promise<{ id: string }>

/** GET /api/products/[id]/reviews — approved reviews + aggregates. */
export async function GET(_: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const [reviews, agg] = await Promise.all([
    prisma.review.findMany({
      where: { productId: id, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
    prisma.review.groupBy({
      by: ['rating'],
      where: { productId: id, status: 'APPROVED' },
      _count: { id: true },
    }),
  ])

  const histogram: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let total = 0
  let sum = 0
  for (const row of agg) {
    histogram[row.rating] = row._count.id
    total += row._count.id
    sum += row.rating * row._count.id
  }

  return NextResponse.json({
    average: total > 0 ? Math.round((sum / total) * 10) / 10 : null,
    total,
    histogram,
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      images: r.images,
      authorName: r.user.name,
      verified: r.orderId != null,
      adminReply: r.adminReply,
      createdAt: r.createdAt,
    })),
  })
}

const createSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10, 'Review must be at least 10 characters').max(3000),
  images: z.array(z.string().url()).max(4).default([]),
})

/**
 * POST — create a review. One per user per product. Verified-purchase flag
 * set when the user has a DELIVERED (or later happy-path) order containing
 * this product. Reviews land as PENDING until admin approval.
 */
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const limited = rateLimit(req, 'reviews', 5)
  if (limited) return limited

  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Sign in to write a review' }, { status: 401 })
  const { id } = await params

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid review' },
      { status: 400 },
    )
  }

  // Verified purchase: a delivered order containing any variant of this product.
  const deliveredItem = await prisma.orderItem.findFirst({
    where: {
      variant: { productId: id },
      order: {
        userId: user.id,
        status: { in: ['DELIVERED', 'DEPOSIT_REFUNDED'] },
      },
    },
    select: { orderId: true },
  })

  try {
    const review = await prisma.review.create({
      data: {
        productId: id,
        userId: user.id,
        orderId: deliveredItem?.orderId ?? null,
        rating: parsed.data.rating,
        title: parsed.data.title || null,
        body: parsed.data.body,
        images: parsed.data.images,
      },
    })
    return NextResponse.json(
      { ok: true, id: review.id, verified: review.orderId != null, pendingModeration: true },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      { error: 'You have already reviewed this piece — thank you!' },
      { status: 409 },
    )
  }
}
