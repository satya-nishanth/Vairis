import { prisma } from '@/lib/prisma'
import { OrderFinanceManager, type OrderSheetBoot } from '@/components/admin/OrderFinanceManager'
import { sheetTotals } from '@/lib/finance'
import { getOrderItemQuotes } from '@/lib/finance-order-quotes'
import { listRecentFinanceOrders, searchFinanceOrders } from '@/lib/finance-order-search'

export const dynamic = 'force-dynamic'

const RECENT_ORDERS = 8

export default async function FinanceOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; q?: string }>
}) {
  const sp = await searchParams
  const selectedOrderId = sp.orderId?.trim() || null
  const searchQ = !selectedOrderId && sp.q && sp.q.trim().length >= 2 ? sp.q.trim() : null

  const [rows, accounts, recentOrders, searchHits] = await Promise.all([
    prisma.orderFinance.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        lines: true,
        paidToAccount: { select: { id: true, name: true } },
        order: { select: { contactName: true, grandTotal: true } },
      },
    }),
    prisma.financeAccount.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    listRecentFinanceOrders(RECENT_ORDERS),
    searchQ ? searchFinanceOrders(searchQ) : Promise.resolve([]),
  ])

  const companyBank = accounts.find((a) => a.name.toLowerCase().includes('vairis')) ?? accounts[0]
  const fallbackPaidTo = companyBank?.id ?? accounts[0]?.id ?? ''

  let boot: OrderSheetBoot | null = null
  if (selectedOrderId) {
    const [order, quotes] = await Promise.all([
      prisma.order.findUnique({
        where: { id: selectedOrderId },
        select: {
          id: true,
          contactName: true,
          contactPhone: true,
          grandTotal: true,
          status: true,
          finance: {
            select: {
              paidToAccountId: true,
              lines: {
                select: { id: true, kind: true, costPrice: true, sellingPrice: true, sortOrder: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      }),
      getOrderItemQuotes(selectedOrderId),
    ])

    if (order) {
      boot = {
        orderId: order.id,
        orderLabel: order.id,
        orderMeta: {
          phone: order.contactPhone,
          total: Number(order.grandTotal),
          status: order.status,
        },
        paidToAccountId: order.finance?.paidToAccountId || fallbackPaidTo,
        lines: (order.finance?.lines ?? []).map((l) => ({
          id: l.id,
          kind: l.kind,
          costPrice: Number(l.costPrice),
          sellingPrice: Number(l.sellingPrice),
        })),
        quotes,
      }
    }
  }

  return (
    <OrderFinanceManager
      key={selectedOrderId ?? (searchQ ? `q:${searchQ}` : 'pick')}
      selectedOrderId={selectedOrderId}
      boot={boot}
      initialSearchQuery={searchQ}
      initialSearchHits={searchQ ? searchHits : null}
      accounts={accounts}
      defaultPaidToAccountId={companyBank?.id ?? null}
      recentOrders={recentOrders}
      initial={rows.map((r) => {
        const lines = [...r.lines]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((l) => ({
            id: l.id,
            kind: l.kind,
            costPrice: Number(l.costPrice),
            sellingPrice: Number(l.sellingPrice),
          }))
        const totals = sheetTotals(lines)
        return {
          id: r.id,
          orderId: r.orderId,
          paidToAccountId: r.paidToAccountId,
          paidToAccountName: r.paidToAccount.name,
          lines,
          cost: totals.cost,
          sellingPrice: totals.selling,
          profit: totals.profit,
          order: r.order
            ? { contactName: r.order.contactName, grandTotal: Number(r.order.grandTotal) }
            : undefined,
        }
      })}
    />
  )
}
