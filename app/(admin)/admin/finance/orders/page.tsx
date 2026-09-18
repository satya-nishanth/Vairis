import { prisma } from '@/lib/prisma'
import { OrderFinanceManager, type OrderSheetBoot } from '@/components/admin/OrderFinanceManager'
import { getOrderItemQuotes } from '@/lib/finance-order-quotes'
import { listRecentFinanceOrders, searchFinanceOrders } from '@/lib/finance-order-search'
import { loadOrderSheetPaymentGroups } from '@/lib/finance-order-sheet-payments'
import {
  collectedByOrderIds,
  orderPaymentSummary,
  settledInCompanyBankByOrderIds,
} from '@/lib/finance-collections'
import { sheetTotals } from '@/lib/finance'

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

  const [accounts, allVendors, recentOrders, searchHits] = await Promise.all([
    prisma.financeAccount.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, type: true, isVendorWallet: true },
    }),
    prisma.financeAccount.findMany({
      where: {
        active: true,
        OR: [{ type: 'VENDOR' }, { isVendorWallet: true }],
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, type: true, isVendorWallet: true, vendorOutflowSource: true },
    }),
    listRecentFinanceOrders(LIST_ORDERS),
    searchQ ? searchFinanceOrders(searchQ) : Promise.resolve([]),
  ])

  let vendorAccounts = allVendors
    .filter((v) => v.vendorOutflowSource === 'ORDER_SHEETS' || v.vendorOutflowSource === 'BOTH')
    .map(({ id, name, type, isVendorWallet }) => ({ id, name, type, isVendorWallet }))

  const companyBank = accounts.find((a) => a.name.toLowerCase().includes('vairis')) ?? accounts[0]
  const fallbackPaidTo = companyBank?.id ?? accounts[0]?.id ?? ''

  let boot: OrderSheetBoot | null = null
  if (selectedOrderId) {
    const [order, quotes, paymentGroups, collectedMap, inBankMap] = await Promise.all([
      prisma.order.findUnique({
        where: { id: selectedOrderId },
        select: {
          id: true,
          contactName: true,
          contactPhone: true,
          grandTotal: true,
          status: true,
          createdAt: true,
          items: { select: { productName: true, quantity: true }, take: 4 },
          _count: { select: { items: true } },
          finance: {
            select: {
              paidToAccountId: true,
              purchaseFromAccountId: true,
              roundOffEnabled: true,
              manuallySettledAt: true,
              manuallySettledNote: true,
              manuallySettledBy: true,
              lines: {
                select: { id: true, kind: true, costPrice: true, sellingPrice: true, sortOrder: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      }),
      getOrderItemQuotes(selectedOrderId),
      loadOrderSheetPaymentGroups(selectedOrderId),
      collectedByOrderIds([selectedOrderId]),
      settledInCompanyBankByOrderIds([selectedOrderId]),
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

      const sheetLines = (order.finance?.lines ?? []).map((l) => ({
        id: l.id,
        kind: l.kind,
        costPrice: Number(l.costPrice),
        sellingPrice: Number(l.sellingPrice),
      }))
      const sheetTot = sheetTotals(
        sheetLines.map((l) => ({
          kind: l.kind as never,
          costPrice: l.costPrice,
          sellingPrice: l.sellingPrice,
        })),
        { roundOffEnabled: Boolean(order.finance?.roundOffEnabled) },
      )
      const payment = orderPaymentSummary({
        grandTotal: Number(order.grandTotal),
        sheetSelling: sheetTot.selling > 0 ? sheetTot.selling : null,
        collected: collectedMap.get(order.id) ?? 0,
        settledInCompanyBank: inBankMap.get(order.id) ?? 0,
        manuallySettled: Boolean(order.finance?.manuallySettledAt),
      })

      boot = {
        orderId: order.id,
        orderLabel: order.contactName || order.id,
        orderMeta: {
          phone: order.contactPhone,
          total: Number(order.grandTotal),
          status: order.status,
          itemsLabel,
          createdAt: order.createdAt.toISOString(),
        },
        paidToAccountId: order.finance?.paidToAccountId || fallbackPaidTo,
        purchaseFromAccountId: order.finance?.purchaseFromAccountId ?? null,
        lines: sheetLines,
        quotes,
        hasSheet: Boolean(order.finance),
        roundOffEnabled: order.finance
          ? Boolean(order.finance.roundOffEnabled)
          : true,
        manuallySettled: Boolean(order.finance?.manuallySettledAt),
        manuallySettledNote: order.finance?.manuallySettledNote ?? null,
        manuallySettledBy: order.finance?.manuallySettledBy ?? null,
        manuallySettledAt: order.finance?.manuallySettledAt?.toISOString() ?? null,
        paymentSummary: {
          expected: payment.expected,
          collected: payment.collected,
          balance: payment.balance,
          paymentStatus: payment.paymentStatus,
          settledInCompanyBank: inBankMap.get(order.id) ?? 0,
        },
        paymentGroups,
      }

      // Keep a saved transactions-only vendor visible on edit so the select isn't blank.
      const savedVendorId = boot.purchaseFromAccountId
      if (savedVendorId && !vendorAccounts.some((v) => v.id === savedVendorId)) {
        const orphan = allVendors.find((v) => v.id === savedVendorId)
        if (orphan) {
          vendorAccounts = [
            ...vendorAccounts,
            {
              id: orphan.id,
              name: `${orphan.name} (txns only)`,
              type: orphan.type,
              isVendorWallet: orphan.isVendorWallet,
            },
          ]
        }
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
      vendorAccounts={vendorAccounts}
      defaultPaidToAccountId={companyBank?.id ?? null}
      recentOrders={recentOrders}
    />
  )
}
