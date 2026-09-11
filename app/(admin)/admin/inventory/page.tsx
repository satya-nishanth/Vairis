import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { isFinanceEmail } from '@/lib/finance-auth'
import { inventoryItemInclude } from '@/lib/inventory'
import { getLiveUnitPricesByVariantId } from '@/lib/inventory-pricing'
import { InventoryList } from '@/components/admin/InventoryList'

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
  const session = await requireAdmin()
  const isFinance = isFinanceEmail(session.user.email)

  const [rows, holders, soldQtyRows] = await Promise.all([
    prisma.inventoryItem.findMany({
      include: {
        ...inventoryItemInclude,
        sales: {
          orderBy: { soldAt: 'desc' },
          take: 1,
          include: { order: { select: { id: true, contactName: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    }),
    prisma.inventoryHolder.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.inventorySale.groupBy({
      by: ['inventoryItemId'],
      _sum: { qty: true },
    }),
  ])

  const soldQtyByItem = Object.fromEntries(
    soldQtyRows.map((s) => [s.inventoryItemId, s._sum.qty ?? 0]),
  )

  const variantIds = rows.map((r) => r.variantId).filter((id): id is string => id != null)
  const liveByVariantId = await getLiveUnitPricesByVariantId(variantIds)

  const serialized = rows.map((r) => {
    const latest = r.sales[0]
    return {
      id: r.id,
      qtyOnHand: r.qtyOnHand,
      qtySold: soldQtyByItem[r.id] ?? 0,
      purchasePrice: isFinance && r.purchasePrice != null ? Number(r.purchasePrice) : null,
      soldPrice: r.soldPrice != null ? Number(r.soldPrice) : null,
      potentialPrice: isFinance && r.potentialPrice != null ? Number(r.potentialPrice) : null,
      liveSoldPrice: r.variantId ? (liveByVariantId[r.variantId] ?? null) : null,
      latestSale: latest
        ? {
            qty: latest.qty,
            soldAt: latest.soldAt.toISOString(),
            orderId: latest.orderId,
            unlinkedOrderLabel: latest.unlinkedOrderLabel,
            order: latest.order,
          }
        : null,
      customName: r.customName,
      updatedAt: r.updatedAt.toISOString(),
      holder: r.holder,
      product: r.product,
      variant: r.variant,
      purchaseBills: (r.purchaseBills ?? []).map((l) => ({
        id: l.purchaseBill.id,
        billNumber: l.purchaseBill.billNumber,
        supplierName: l.purchaseBill.supplierName,
        href: isFinance
          ? `/admin/finance/purchase-bills?edit=${encodeURIComponent(l.purchaseBill.id)}`
          : null,
      })),
      _count: r._count,
    }
  })

  return (
    <div className="admin-page admin-page--inventory">
      <h1 className="admin-page__title">Inventory</h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 0, marginBottom: 16 }}>
        Track physical stock and who holds each unit. Link items to the catalogue before selling via
        manual orders.
      </p>
      <InventoryList initialRows={serialized} holders={holders} isFinance={isFinance} />
    </div>
  )
}
