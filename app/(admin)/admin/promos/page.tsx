import { AdminGuide } from '@/components/admin/AdminGuide'
import { prisma } from '@/lib/prisma'
import { loadScopeOptions, promoScopeInclude } from '@/lib/discount-scope'
import { PromosManager } from './PromosManager'

export const dynamic = 'force-dynamic'

export default async function AdminPromosPage() {
  const [promos, options] = await Promise.all([
    prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } }, ...promoScopeInclude },
    }),
    loadScopeOptions(),
  ])

  return (
    <div className="admin-page admin-page--promos">
      <AdminGuide
        pageKey="promos"
        title="Promos"
        blurb="Create/disable coupon codes with optional product scope. Stack after automatic discounts."
        tips={[
          'Types: %/₹ off goods, free delivery (delivery component), or making-charge off.',
          'First order only = no prior captured payment on the account.',
          'Everyone = whole cart. Specific = only matching products.',
          "Codes with redemptions are deactivated instead of deleted.",
        ]}
      />
      <PromosManager
        products={options.products}
        collections={options.collections}
        storeCategories={options.storeCategories}
        initial={promos.map((p) => ({
          id: p.id,
          code: p.code,
          description: p.description ?? '',
          kind: p.kind,
          value: Number(p.value),
          minOrderValue: Number(p.minOrderValue),
          maxDiscount: p.maxDiscount != null ? Number(p.maxDiscount) : null,
          startsAt: p.startsAt?.toISOString() ?? null,
          endsAt: p.endsAt?.toISOString() ?? null,
          maxRedemptions: p.maxRedemptions,
          maxPerUser: p.maxPerUser,
          firstOrderOnly: p.firstOrderOnly,
          active: p.active,
          redemptionCount: p._count.redemptions,
          productIds: p.products.map((x) => x.productId),
          collectionIds: p.collections.map((x) => x.collectionId),
          storeCategoryIds: p.storeCategories.map((x) => x.storeCategoryId),
          categories: p.categories.map((x) => x.category),
        }))}
      />
    </div>
  )
}
