import { prisma } from '@/lib/prisma'
import { AdminGuide } from '@/components/admin/AdminGuide'
import { CollectionsManager } from './CollectionsManager'

export const dynamic = 'force-dynamic'

export default async function AdminCollectionsPage() {
  const [collections, products] = await Promise.all([
    prisma.collection.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      include: { products: { orderBy: { sortOrder: 'asc' }, select: { productId: true } } },
    }),
    prisma.product.findMany({
      where: { status: 'LIVE', isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, itemCode: true, category: true },
    }),
  ])

  return (
    <div className="admin-page" style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Collections
      </h1>
      <AdminGuide
        pageKey="collections"
        title="Collections"
        blurb="Curated product groupings shown on collection pages (/collections/slug)."
        tips={[
          '"Show in nav" pins the collection into the storefront header (Active must also be on).',
          'A product can belong to multiple collections.',
          'Slug must be unique — reusing gifting / limited-edition will fail to save.',
          'Attach a collection rail to the home page from Home Sections.',
        ]}
      />
      <CollectionsManager
        collections={collections.map((c) => ({
          id: c.id,
          slug: c.slug,
          title: c.title,
          subtitle: c.subtitle ?? '',
          description: c.description ?? '',
          heroImages: c.heroImages,
          active: c.active,
          showInNav: c.showInNav,
          productIds: c.products.map((p) => p.productId),
        }))}
        allProducts={products.map((p) => ({
          id: p.id,
          label: `${p.name}${p.itemCode ? ` (${p.itemCode})` : ''} — ${p.category.toLowerCase()}`,
        }))}
      />
    </div>
  )
}
