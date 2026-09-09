import { prisma } from '@/lib/prisma'
import { OrderFinanceManager, type OrderSheetBoot } from '@/components/admin/OrderFinanceManager'
import { getOrderItemQuotes } from '@/lib/finance-order-quotes'
import { listRecentFinanceOrders, searchFinanceOrders } from '@/lib/finance-order-search'

export const dynamic = 'force-dynamic'

const LIST_ORDERS = 40

type SheetFilter = 'all' | 'incomplete' | 'complete'

function parseFilter(raw: string | undefined): SheetFilter {
  if (raw === 'incomplete' || raw === 'complete') return raw
  return 'all'
}

export default async function FinanceOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    orderId?: string
    q?: string
    saved?: string
    error?: string
    filter?: string
  }>
}) {
  const sp = await searchParams
  const selectedOrderId = sp.orderId?.trim() || null
  const searchQ = !selectedOrderId && sp.q && sp.q.trim().length >= 2 ? sp.q.trim() : null
  const saveFlash = sp.saved === '1'
  const saveError = sp.error?.trim() || null
  const initialFilter = parseFilter(sp.filter)

  const [accounts, recentOrders, searchHits] = await Promise.all([
    prisma.financeAccount.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    listRecentFinanceOrders(LIST_ORDERS),
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
          items: { select: { productName: true, quantity: true }, take: 4 },
          _count: { select: { items: true } },
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
      const items = order.items
      let itemsLabel = '—'
      if (items.length === 1) {
        const i = items[0]
        itemsLabel = i.quantity > 1 ? `${i.productName} ×${i.quantity}` : i.productName
      } else if (items.length > 1) {
        const more = Math.max(0, order._count.items - 1)
        itemsLabel = more > 0 ? `${items[0].productName} +${more} more` : items[0].productName
      }

      boot = {
        orderId: order.id,
        orderLabel: order.contactName || order.id,
        orderMeta: {
          phone: order.contactPhone,
          total: Number(order.grandTotal),
          status: order.status,
          itemsLabel,
        },
        paidToAccountId: order.finance?.paidToAccountId || fallbackPaidTo,
        lines: (order.finance?.lines ?? []).map((l) => ({
          id: l.id,
          kind: l.kind,
          costPrice: Number(l.costPrice),
          sellingPrice: Number(l.sellingPrice),
        })),
        quotes,
        hasSheet: Boolean(order.finance),
      }
    }
  }

  return (
    <OrderFinanceManager
      key={`${selectedOrderId ?? (searchQ ? `q:${searchQ}` : 'pick')}-${saveFlash ? 'saved' : 'n'}-${saveError ?? ''}-${initialFilter}`}
      selectedOrderId={selectedOrderId}
      boot={boot}
      initialSearchQuery={searchQ}
      initialSearchHits={searchQ ? searchHits : null}
      initialSaveFlash={saveFlash}
      initialSaveError={saveError}
      initialFilter={initialFilter}
      accounts={accounts}
      defaultPaidToAccountId={companyBank?.id ?? null}
      recentOrders={recentOrders}
    />
  )
}
