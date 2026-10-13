import { prisma } from '@/lib/prisma'
import { prismaToProduct } from '@/lib/prisma-to-product'
import { getPricingConfig, getShowPricesGlobal } from '@/lib/pricing-data'
import type { Product } from '@/lib/ui-data'

/**
 * DB-driven home sections (HomeSection table) — ordered, schedulable blocks
 * the admin manages at /admin/sections. Rendered between the hero and the
 * built-in sections on the home page; zero rows = home unchanged.
 *
 * Kinds + config shapes (config is Json):
 *   collection-rail { collectionSlug: string, limit?: number }
 *   editorial       { image: string, ctaLabel?: string, ctaHref?: string }
 *   video           { url: string, poster?: string }
 *   usp             { items: { icon?: string, title: string, description?: string }[] }
 */

export type HomeSectionView =
  | {
      kind: 'collection-rail'
      id: string
      title: string | null
      subtitle: string | null
      collectionSlug: string
      products: Product[]
    }
  | {
      kind: 'editorial'
      id: string
      title: string | null
      subtitle: string | null
      image: string | null
      ctaLabel: string | null
      ctaHref: string | null
    }
  | {
      kind: 'video'
      id: string
      title: string | null
      subtitle: string | null
      url: string
      poster: string | null
    }
  | {
      kind: 'usp'
      id: string
      title: string | null
      subtitle: string | null
      items: { icon?: string; title: string; description?: string }[]
    }

export async function getActiveHomeSections(): Promise<HomeSectionView[]> {
  const now = new Date()
  const rows = await prisma.homeSection.findMany({
    where: {
      active: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { sortOrder: 'asc' },
  })
  if (rows.length === 0) return []

  const [goldRates, pricingConfig, showPricesGlobal] = await Promise.all([
    prisma.goldRate.findMany(),
    getPricingConfig(),
    getShowPricesGlobal(),
  ])

  const views: HomeSectionView[] = []
  for (const row of rows) {
    try {
      const config = (row.config ?? {}) as Record<string, unknown>
      if (row.kind === 'collection-rail') {
        const slug = String(config.collectionSlug ?? '')
        if (!slug) continue
        const collection = await prisma.collection.findUnique({
          where: { slug },
          include: {
            products: {
              orderBy: { sortOrder: 'asc' },
              take: Number(config.limit ?? 8),
              include: {
                product: {
                  include: {
                    variants: true,
                    stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
                  },
                },
              },
            },
          },
        })
        if (!collection || !collection.active) continue
        const liveProducts = (collection.products ?? [])
          .map((cp) => cp?.product)
          .filter((p): p is NonNullable<typeof p> => Boolean(p && p.isActive && p.status === 'LIVE'))
          .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''))
        const { autoDiscountPercentsForProducts } = await import('@/lib/auto-discount-display')
        const saleMap = await autoDiscountPercentsForProducts(liveProducts)
        const validProducts = liveProducts.map((p, i) =>
          prismaToProduct(p, goldRates, i, pricingConfig, showPricesGlobal, saleMap.get(p.id)),
        )

        if (validProducts.length === 0) continue

        views.push({
          kind: 'collection-rail',
          id: row.id,
          title: row.title ?? collection.title,
          subtitle: row.subtitle ?? collection.subtitle,
          collectionSlug: slug,
          products: validProducts,
        })
      } else if (row.kind === 'editorial') {
        views.push({
          kind: 'editorial',
          id: row.id,
          title: row.title,
          subtitle: row.subtitle,
          image: typeof config.image === 'string' ? config.image : null,
          ctaLabel: typeof config.ctaLabel === 'string' ? config.ctaLabel : null,
          ctaHref: typeof config.ctaHref === 'string' ? config.ctaHref : null,
        })
      } else if (row.kind === 'video') {
        if (typeof config.url !== 'string' || !config.url) continue
        views.push({
          kind: 'video',
          id: row.id,
          title: row.title,
          subtitle: row.subtitle,
          url: config.url,
          poster: typeof config.poster === 'string' ? config.poster : null,
        })
      } else if (row.kind === 'usp') {
        const items = Array.isArray(config.items)
          ? (config.items as { icon?: string; title: string; description?: string }[]).filter(
              (i) => i && typeof i.title === 'string',
            )
          : []
        if (items.length === 0) continue
        views.push({ kind: 'usp', id: row.id, title: row.title, subtitle: row.subtitle, items })
      }
    } catch (err) {
      console.error(`[getActiveHomeSections] Failed to load home section ${row.id}:`, err)
    }
  }
  return views
}
