import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGuestUser } from '@/lib/catalogue-auth'
import { fetchAllReactionRows, fetchGuestReactionRows } from '@/lib/catalogue-reactions'
import { normReaction } from '@/lib/catalogue-admin-stats'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Full catalogue feed — every active product, no pagination cap.
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
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

  const [reactions, commentCounts] = await Promise.all([
    fetchAllReactionRows(),
    prisma.catalogueComment.groupBy({
      by: ['productId'],
      _count: { _all: true },
    }),
  ])

  const likeMap: Record<string, number> = {}
  const dislikeMap: Record<string, number> = {}
  for (const row of reactions) {
    const kind = normReaction(row.reaction)
    if (kind === 'like') likeMap[row.productId] = (likeMap[row.productId] ?? 0) + 1
    else if (kind === 'dislike') dislikeMap[row.productId] = (dislikeMap[row.productId] ?? 0) + 1
  }
  const commentMap = Object.fromEntries(commentCounts.map((r) => [r.productId, r._count._all]))

  const guest = await getGuestUser()
  let myReactions: Record<string, string> = {}
  if (guest) {
    const guestRows = await fetchGuestReactionRows(guest.id)
    myReactions = Object.fromEntries(guestRows.map((r) => [r.productId, r.reaction]))
  }

  const framesWithMeta = frames.map((f) => ({
    ...f,
    likes: likeMap[f.productId] ?? 0,
    dislikes: dislikeMap[f.productId] ?? 0,
    comments: commentMap[f.productId] ?? 0,
    myReaction: myReactions[f.productId] ?? null,
  }))

  return NextResponse.json({ frames: framesWithMeta, guestId: guest?.id ?? null })
}
