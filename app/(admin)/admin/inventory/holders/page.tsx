import { prisma } from '@/lib/prisma'
import { InventoryHoldersManager } from '@/components/admin/InventoryHoldersManager'

export const dynamic = 'force-dynamic'

export default async function InventoryHoldersPage() {
  const holders = await prisma.inventoryHolder.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { items: true } } },
  })

  const initial = holders.map((h) => ({
    id: h.id,
    name: h.name,
    active: h.active,
    sortOrder: h.sortOrder,
    itemCount: h._count.items,
  }))

  return (
    <div className="admin-page admin-page--inventory">
      <h1 className="admin-page__title">Inventory holders</h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 0, marginBottom: 16 }}>
        People or locations that physically hold stock (workshop, store, karigar, etc.).
      </p>
      <InventoryHoldersManager initial={initial} />
    </div>
  )
}
