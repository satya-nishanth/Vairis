import { prisma } from '@/lib/prisma'
import { inventoryItemInclude } from '@/lib/inventory'
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

  const serialized = rows.map((r) => ({
    ...r,
    updatedAt: r.updatedAt.toISOString(),
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
