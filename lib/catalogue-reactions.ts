import { prisma } from '@/lib/prisma'

export type ReactionCountRow = { productId: string; reaction: string }

/** Prod DB stores reaction as a PG enum; Prisma schema uses String → cast on read (P2032). */
export async function fetchAllReactionRows(): Promise<ReactionCountRow[]> {
  return prisma.$queryRaw<ReactionCountRow[]>`
    SELECT "productId", "reaction"::text AS reaction
    FROM "CatalogueReaction"
  `
}

export async function fetchGuestReactionRows(guestUserId: string): Promise<ReactionCountRow[]> {
  return prisma.$queryRaw<ReactionCountRow[]>`
    SELECT "productId", "reaction"::text AS reaction
    FROM "CatalogueReaction"
    WHERE "guestUserId" = ${guestUserId}
  `
}

export type ProductReactionDetail = {
  id: string
  guestUserId: string
  reaction: string
  updatedAt: Date
}

export async function fetchProductReactionDetails(
  productId: string,
  limit = 500
): Promise<ProductReactionDetail[]> {
  return prisma.$queryRaw<ProductReactionDetail[]>`
    SELECT id, "guestUserId", "reaction"::text AS reaction, "updatedAt"
    FROM "CatalogueReaction"
    WHERE "productId" = ${productId}
    ORDER BY "updatedAt" DESC
    LIMIT ${limit}
  `
}

export async function fetchGuestProductReaction(
  guestUserId: string,
  productId: string
): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ reaction: string }[]>`
    SELECT "reaction"::text AS reaction
    FROM "CatalogueReaction"
    WHERE "guestUserId" = ${guestUserId} AND "productId" = ${productId}
    LIMIT 1
  `
  return rows[0]?.reaction ?? null
}
