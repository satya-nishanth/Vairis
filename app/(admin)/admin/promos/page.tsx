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
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        Percent or flat discounts applied at checkout. Codes with redemptions are
        deactivated instead of deleted so order history stays intact.
      </p>
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
