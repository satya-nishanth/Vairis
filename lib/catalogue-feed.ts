import { isVideo } from '@/lib/imageUrl'

export type CatalogueMedia = {
  url: string
  isVideo: boolean
}

export type CatalogueProduct = {
  productId: string
  name: string
  category: string
  description: string
  itemCode: string | null
  stoneType: string | null
  caratWeight: number | null
  isActive: boolean
  media: CatalogueMedia[]
  likes: number
  dislikes: number
  commentCount: number
  myReaction: 'like' | 'dislike' | null
}

/** Videos first (original order), then images — per catalogue rules. */
export function sortProductMedia(urls: string[]): CatalogueMedia[] {
  const videos: string[] = []
  const images: string[] = []
  for (const url of urls) {
    if (isVideo(url)) videos.push(url)
    else images.push(url)
  }
  return [...videos, ...images].map((url) => ({ url, isVideo: isVideo(url) }))
}

export function totalMediaCount(products: CatalogueProduct[]): number {
  return products.reduce((n, p) => n + Math.max(p.media.length, 1), 0)
}

export function toFlatIndex(
  products: CatalogueProduct[],
  productIndex: number,
  mediaIndex: number
): number {
  let flat = 0
  for (let i = 0; i < productIndex && i < products.length; i++) {
    flat += Math.max(products[i].media.length, 1)
  }
  return flat + mediaIndex
}

export function positionFromFlatIndex(
  products: CatalogueProduct[],
  flatIndex: number
): { productIndex: number; mediaIndex: number } {
  let remaining = Math.max(0, flatIndex)
  for (let i = 0; i < products.length; i++) {
    const len = Math.max(products[i].media.length, 1)
    if (remaining < len) return { productIndex: i, mediaIndex: remaining }
    remaining -= len
  }
  const last = Math.max(0, products.length - 1)
  const lastLen = Math.max(products[last]?.media.length ?? 1, 1)
  return { productIndex: last, mediaIndex: lastLen - 1 }
}
