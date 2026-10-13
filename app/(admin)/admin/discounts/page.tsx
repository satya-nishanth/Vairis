import { prisma } from '@/lib/prisma'
import { autoScopeInclude, loadScopeOptions } from '@/lib/discount-scope'
import { DiscountsManager } from './DiscountsManager'

export const dynamic = 'force-dynamic'

export default async function AdminDiscountsPage() {
  const [rows, options] = await Promise.all([
    prisma.automaticDiscount.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: autoScopeInclude,
    }),
    loadScopeOptions(),
  ])

  return (
    <div className="admin-page admin-page--discounts">
      <DiscountsManager
        products={options.products}
        collections={options.collections}
        storeCategories={options.storeCategories}
        initial={rows.map((r) => ({
          id: r.id,
          name: r.name,
          displayName: r.displayName,
          percent: Number(r.percent),
          maxDiscount: r.maxDiscount != null ? Number(r.maxDiscount) : null,
          startsAt: r.startsAt?.toISOString() ?? null,
          endsAt: r.endsAt?.toISOString() ?? null,
          priority: r.priority,
          active: r.active,
          productIds: r.products.map((x) => x.productId),
          collectionIds: r.collections.map((x) => x.collectionId),
          storeCategoryIds: r.storeCategories.map((x) => x.storeCategoryId),
          categories: r.categories.map((x) => x.category),
        }))}
      />
    </div>
  )
}
