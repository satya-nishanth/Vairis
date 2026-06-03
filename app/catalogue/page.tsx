import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { sortProductMedia, totalMediaCount, positionFromFlatIndex } from '@/lib/catalogue-feed'
import { getResumeFlatIndex } from '@/lib/catalogue-progress'
import CatalogueReel from './CatalogueReel'
import { redirect } from 'next/navigation'
import { loadReactionCountMaps } from '@/lib/catalogue-admin-stats'
import type { CatalogueProduct } from '@/lib/catalogue-feed'

export const dynamic = 'force-dynamic'

async function getGuestFromCookie() {
  const jar = await cookies()
  const id = jar.get('catalogue_guest')?.value
  if (!id) return null
  return prisma.guestUser.findUnique({ where: { id } })
}

async function getProducts(): Promise<Omit<CatalogueProduct, 'likes' | 'dislikes' | 'commentCount' | 'myReaction'>[]> {
  const rows = await prisma.product.findMany({
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

  return rows.map((p) => ({
    productId: p.id,
    name: p.name,
    category: p.category as string,
    description: p.description,
    itemCode: p.itemCode ?? null,
    stoneType: p.stoneType ?? null,
    caratWeight: p.caratWeight ? Number(p.caratWeight) : null,
    media: sortProductMedia(p.images ?? []),
  }))
}

async function getProgress(guestId: string) {
  return prisma.catalogueProgress.findUnique({ where: { guestUserId: guestId } })
}

async function getReactions(guestId: string) {
  const rows = await prisma.catalogueReaction.findMany({ where: { guestUserId: guestId } })
  return Object.fromEntries(rows.map((r) => [r.productId, r.reaction]))
}

async function getReactionCounts() {
  return loadReactionCountMaps()
}

async function getCommentCounts() {
  const rows = await prisma.catalogueComment.groupBy({
    by: ['productId'],
    _count: { _all: true },
  })
  return Object.fromEntries(rows.map((r) => [r.productId, r._count._all]))
}

export default async function CataloguePage() {
  const guest = await getGuestFromCookie()
  if (!guest) redirect('/catalogue/login')

  const [baseProducts, progress, myReactions, { likeMap, dislikeMap }, commentCountMap] =
    await Promise.all([
      getProducts(),
      getProgress(guest.id),
      getReactions(guest.id),
      getReactionCounts(),
      getCommentCounts(),
    ])

  const products: CatalogueProduct[] = baseProducts.map((p) => ({
    ...p,
    likes: likeMap[p.productId] ?? 0,
    dislikes: dislikeMap[p.productId] ?? 0,
    commentCount: commentCountMap[p.productId] ?? 0,
    myReaction: (myReactions[p.productId] ?? null) as 'like' | 'dislike' | null,
  }))

  const totalMedia = totalMediaCount(products)
  const startFlat = getResumeFlatIndex(progress?.lastFrameIndex, totalMedia)
  const { productIndex, mediaIndex } = positionFromFlatIndex(products, startFlat)

  return (
    <CatalogueReel
      products={products}
      startProductIndex={productIndex}
      startMediaIndex={mediaIndex}
      startFlatIndex={startFlat}
      guestUsername={guest.username}
    />
  )
}
