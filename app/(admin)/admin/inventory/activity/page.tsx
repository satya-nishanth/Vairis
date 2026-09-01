import { prisma } from '@/lib/prisma'
import { InventoryActivityClient } from '@/components/admin/InventoryActivityClient'

export const dynamic = 'force-dynamic'

export default async function InventoryActivityPage() {
  const rows = await prisma.inventoryAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  return (
    <div className="admin-page admin-page--inventory">
      <h1 className="admin-page__title">Inventory activity</h1>
      <InventoryActivityClient
        initial={rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          actorEmail: r.actorEmail,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          objectLabel: r.objectLabel,
          objectHref: r.objectHref,
          summary: r.summary,
          before: r.before,
          after: r.after,
        }))}
      />
    </div>
  )
}
