import { prisma } from '@/lib/prisma'
import { fetchAllReactionRows } from '@/lib/catalogue-reactions'

export function normReaction(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function aggregateReactionRows(reactions: { productId: string; reaction: string }[]) {
  const likeMap: Record<string, number> = {}
  const dislikeMap: Record<string, number> = {}
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

  return { likeMap, dislikeMap, totalLikes, totalDislikes }
}

/** Aggregate comment + reaction counts per product (case-insensitive reactions). */
export async function loadCatalogueFeedbackMaps() {
  const [commentGroups, reactions] = await Promise.all([
    prisma.catalogueComment.groupBy({
      by: ['productId'],
      _count: { _all: true },
    }),
    fetchAllReactionRows(),
  ])

  const commentMap: Record<string, number> = {}
  for (const row of commentGroups) {
    commentMap[row.productId] = row._count._all
  }

  const { likeMap, dislikeMap, totalLikes, totalDislikes } = aggregateReactionRows(reactions)
  const totalComments = commentGroups.reduce((n, r) => n + r._count._all, 0)

  return { commentMap, likeMap, dislikeMap, totalComments, totalLikes, totalDislikes }
}

export async function loadReactionCountMaps() {
  const reactions = await fetchAllReactionRows()
  const { likeMap, dislikeMap } = aggregateReactionRows(reactions)
  return { likeMap, dislikeMap }
}
