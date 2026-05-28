import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGuestUser } from '@/lib/catalogue-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        category: true,
        images: true,
        stoneType: true,
        caratWeight: true,
        description: true,
        itemCode: true,
      },
    })

    // flatten into individual media frames so each image/video is a slide
    const frames = products.flatMap((p) =>
      (p.images ?? []).map((url, idx) => ({
        productId: p.id,
        mediaIndex: idx,
        url,
        name: p.name,
        category: p.category,
        description: p.description,
        itemCode: p.itemCode,
        stoneType: p.stoneType,
        caratWeight: p.caratWeight ? Number(p.caratWeight) : null,
      }))
    )

    // per-product reaction counts (no auth needed)
    const [likes, dislikes, commentCounts] = await Promise.all([
      prisma.catalogueReaction.groupBy({
        by: ['productId'],
        where: { reaction: 'like' },
        _count: { _all: true },
      }),
      prisma.catalogueReaction.groupBy({
        by: ['productId'],
        where: { reaction: 'dislike' },
        _count: { _all: true },
      }),
      prisma.catalogueComment.groupBy({
        by: ['productId'],
        _count: { _all: true },
      }),
    ])

    const likeMap = Object.fromEntries(likes.map((r) => [r.productId, r._count._all]))
    const dislikeMap = Object.fromEntries(dislikes.map((r) => [r.productId, r._count._all]))
    const commentMap = Object.fromEntries(commentCounts.map((r) => [r.productId, r._count._all]))

    // guest's own reactions
    const guest = await getGuestUser()
    let myReactions: Record<string, string> = {}
    if (guest) {
      const reactions = await prisma.catalogueReaction.findMany({
        where: { guestUserId: guest.id },
        select: { productId: true, reaction: true },
      })
      myReactions = Object.fromEntries(reactions.map((r) => [r.productId, r.reaction]))
    }

    const framesWithMeta = frames.map((f) => ({
      ...f,
      likes: likeMap[f.productId] ?? 0,
      dislikes: dislikeMap[f.productId] ?? 0,
      comments: commentMap[f.productId] ?? 0,
      myReaction: myReactions[f.productId] ?? null,
    }))

    return NextResponse.json({ frames: framesWithMeta, guestId: guest?.id ?? null })
  } catch (err) {
    console.error('[catalogue GET]', err)
    return NextResponse.json({ error: 'Failed to load catalogue' }, { status: 500 })
  }
}
