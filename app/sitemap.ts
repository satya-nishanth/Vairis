import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thevairis.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, collections] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, status: 'LIVE' },
      select: { id: true, createdAt: true },
    }),
    prisma.collection.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
  ]).catch(() => [[], []] as const)

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: 'daily', priority: 1 },
    ...['rings', 'earrings', 'pendants', 'bracelets', 'necklaces'].map((c) => ({
      url: `${BASE}/all-products/${c}`,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
    { url: `${BASE}/contact`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/returns`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/policies/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/policies/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/policies/shipping`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/policies/refund`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  return [
    ...staticPages,
    ...products.map((p) => ({
      url: `${BASE}/product/${p.id}`,
      lastModified: p.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...collections.map((c) => ({
      url: `${BASE}/collections/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
