import { AdminGuide } from '@/components/admin/AdminGuide'
import { prisma } from '@/lib/prisma'
import { PromosManager } from './PromosManager'

export const dynamic = 'force-dynamic'

export default async function AdminPromosPage() {
  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { redemptions: true } } },
  })

  return (
    <div className="admin-page" style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Promo Codes
      </h1>
      <AdminGuide
        pageKey="promos"
        title="Promos"
        blurb="Create/disable promo codes, track redemptions."
        tips={[
          "Disabling a code doesn't refund carts that already applied it.",
          'Codes with redemptions are deactivated instead of deleted, so order history stays intact.',
        ]}
      />
      <PromosManager
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
          active: p.active,
          redemptionCount: p._count.redemptions,
        }))}
      />
    </div>
  )
}
