import { prisma } from '@/lib/prisma'

export function normReaction(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

/** Aggregate comment + reaction counts per product (case-insensitive reactions). */
export async function loadCatalogueFeedbackMaps() {
  const [commentGroups, reactions] = await Promise.all([
    prisma.catalogueComment.groupBy({
      by: ['productId'],
      _count: { _all: true },
    }),
    // findMany avoids multi-field groupBy + mode:insensitive issues on some prod DB setups
    prisma.catalogueReaction.findMany({
      select: { productId: true, reaction: true },
    }),
  ])

  const commentMap: Record<string, number> = {}
  const likeMap: Record<string, number> = {}
  const dislikeMap: Record<string, number> = {}

  for (const row of commentGroups) {
    commentMap[row.productId] = row._count._all
  }

  let totalLikes = 0
  let totalDislikes = 0

  for (const row of reactions) {
    const kind = normReaction(row.reaction)
    if (kind === 'like') {
      likeMap[row.productId] = (likeMap[row.productId] ?? 0) + 1
      totalLikes++
    } else if (kind === 'dislike') {
      dislikeMap[row.productId] = (dislikeMap[row.productId] ?? 0) + 1
      totalDislikes++
    }
  }

  const totalComments = commentGroups.reduce((n, r) => n + r._count._all, 0)

  return { commentMap, likeMap, dislikeMap, totalComments, totalLikes, totalDislikes }
}

export async function loadReactionCountMaps() {
  const reactions = await prisma.catalogueReaction.findMany({
    select: { productId: true, reaction: true },
  })
  const likeMap: Record<string, number> = {}
  const dislikeMap: Record<string, number> = {}
  for (const row of reactions) {
    const kind = normReaction(row.reaction)
    if (kind === 'like') likeMap[row.productId] = (likeMap[row.productId] ?? 0) + 1
    else if (kind === 'dislike') dislikeMap[row.productId] = (dislikeMap[row.productId] ?? 0) + 1
  }
  return { likeMap, dislikeMap }
}
