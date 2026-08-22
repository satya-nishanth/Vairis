import { prisma } from '@/lib/prisma'
import { OrderFinanceManager } from '@/components/admin/OrderFinanceManager'
import { sheetTotals } from '@/lib/finance'

export const dynamic = 'force-dynamic'

export default async function FinanceOrdersPage() {
  const rows = await prisma.orderFinance.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      order: { select: { contactName: true, grandTotal: true } },
    },
  })
  return (
    <OrderFinanceManager
      initial={rows.map((r) => {
        const lines = r.lines.map((l) => ({
          id: l.id,
          kind: l.kind,
          costPrice: Number(l.costPrice),
          sellingPrice: Number(l.sellingPrice),
        }))
        const totals = sheetTotals(lines)
        return {
          id: r.id,
          orderId: r.orderId,
          customerPaidTo: r.customerPaidTo,
          lines,
          cost: totals.cost,
          sellingPrice: totals.selling,
          profit: totals.profit,
          order: { contactName: r.order.contactName, grandTotal: Number(r.order.grandTotal) },
        }
      })}
    />
  )
}
