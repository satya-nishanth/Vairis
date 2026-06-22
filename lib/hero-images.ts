import { prisma } from '@/lib/prisma'

export const MAX_HERO_IMAGES = 5

export type HeroImageRecord = {
  id: string
  url: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type HeroSlide = {
  id: string
  url: string
}

/** Active hero slides for the landing page carousel, ordered by sortOrder. */
export async function getHeroSlides(): Promise<HeroSlide[]> {
  return prisma.heroImage.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, url: true },
  })
}

/** All hero slides for admin preview, ordered by sortOrder. */
export async function getAllHeroSlides(): Promise<HeroSlide[]> {
  return prisma.heroImage.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, url: true },
  })
}
