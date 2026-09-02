import { prisma } from '@/lib/prisma'
import { FinanceAuditClient } from '@/components/admin/FinanceAuditClient'

export const dynamic = 'force-dynamic'

export default async function FinanceAuditPage() {
  const rows = await prisma.financeAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  return (
    <FinanceAuditClient
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
  )
}
