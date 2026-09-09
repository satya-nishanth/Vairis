import { prisma } from '@/lib/prisma'
import { inventoryItemInclude } from '@/lib/inventory'
import { getLiveUnitPricesByVariantId } from '@/lib/inventory-pricing'
import { InventoryList } from '@/components/admin/InventoryList'

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
  const [rows, holders] = await Promise.all([
    prisma.inventoryItem.findMany({
      include: inventoryItemInclude,
      orderBy: { updatedAt: 'desc' },
      take: 500,
    }),
    prisma.inventoryHolder.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ])

  const variantIds = rows.map((r) => r.variantId).filter((id): id is string => id != null)
  const liveByVariantId = await getLiveUnitPricesByVariantId(variantIds)

  const serialized = rows.map((r) => ({
    id: r.id,
    qtyOnHand: r.qtyOnHand,
    unitPrice: r.unitPrice != null ? Number(r.unitPrice) : null,
    liveUnitPrice: r.variantId ? (liveByVariantId[r.variantId] ?? null) : null,
    customName: r.customName,
    updatedAt: r.updatedAt.toISOString(),
    holder: r.holder,
    product: r.product,
    variant: r.variant,
    _count: r._count,
  }))

  return (
    <div className="admin-page admin-page--inventory">
      <h1 className="admin-page__title">Inventory</h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 0, marginBottom: 16 }}>
        Track physical stock and who holds each unit. Link items to the catalogue before selling via
        manual orders.
      </p>
      <InventoryList initialRows={serialized} holders={holders} />
    </div>
  )
}
