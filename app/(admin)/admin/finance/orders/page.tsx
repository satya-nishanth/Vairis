import { prisma } from '@/lib/prisma'
import { OrderFinanceManager } from '@/components/admin/OrderFinanceManager'
import { orderCost, orderProfit } from '@/lib/finance'

export const dynamic = 'force-dynamic'

export default async function FinanceOrdersPage() {
  const rows = await prisma.orderFinance.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { order: { select: { contactName: true, grandTotal: true } } },
  })
  return (
    <OrderFinanceManager
      initial={rows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        goldCost: Number(r.goldCost),
        diamondCost: Number(r.diamondCost),
        stonesCost: Number(r.stonesCost),
        sellingPrice: Number(r.sellingPrice),
        customerPaidTo: r.customerPaidTo,
        cost: orderCost(Number(r.goldCost), Number(r.diamondCost), Number(r.stonesCost)),
        profit: orderProfit(
          Number(r.sellingPrice),
          orderCost(Number(r.goldCost), Number(r.diamondCost), Number(r.stonesCost)),
        ),
        order: { contactName: r.order.contactName, grandTotal: Number(r.order.grandTotal) },
      }))}
    />
  )
}
