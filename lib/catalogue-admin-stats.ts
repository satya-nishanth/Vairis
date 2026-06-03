import { prisma } from '@/lib/prisma'

export function normReaction(value: string) {
  return value.trim().toLowerCase()
}

/** Aggregate comment + reaction counts per product (case-insensitive reactions). */
export async function loadCatalogueFeedbackMaps() {
  const [commentGroups, reactionGroups] = await Promise.all([
    prisma.catalogueComment.groupBy({
      by: ['productId'],
      _count: { _all: true },
    }),
    prisma.catalogueReaction.groupBy({
      by: ['productId', 'reaction'],
      _count: { _all: true },
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

  for (const row of reactionGroups) {
    const count = row._count._all
    const kind = normReaction(row.reaction)
    if (kind === 'like') {
      likeMap[row.productId] = (likeMap[row.productId] ?? 0) + count
      totalLikes += count
    } else if (kind === 'dislike') {
      dislikeMap[row.productId] = (dislikeMap[row.productId] ?? 0) + count
      totalDislikes += count
    }
  }

  const totalComments = commentGroups.reduce((n, r) => n + r._count._all, 0)

  return { commentMap, likeMap, dislikeMap, totalComments, totalLikes, totalDislikes }
}

export async function loadReactionCountMaps() {
  const { likeMap, dislikeMap } = await loadCatalogueFeedbackMaps()
  return { likeMap, dislikeMap }
}
