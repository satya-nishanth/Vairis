import { prisma } from '@/lib/prisma'
import { isOrderReceiptDirection, roundMoney } from '@/lib/finance'

export type OrderSheetPaymentRow = {
  id: string
  date: string
  amount: number
  direction: 'INFLOW' | 'OUTFLOW' | 'TRANSFER'
  label: string
  description: string
  categoryName: string | null
  href: string
}

export type OrderSheetPaymentGroup = {
  rows: OrderSheetPaymentRow[]
  total: number
}

const VENDOR_CATEGORY_NAMES = new Set(['inventory purchase', 'making / labour'])

function isVendorOutflow(opts: {
  categoryName: string | null
  paidThroughType: string
  paidThroughIsVendor: boolean
}): boolean {
  if (opts.paidThroughType === 'VENDOR' || opts.paidThroughIsVendor) return true
  const cat = (opts.categoryName ?? '').trim().toLowerCase()
  return VENDOR_CATEGORY_NAMES.has(cat)
}

/**
 * Cashbook rows allocated to this order, split for the order-sheet detail UI:
 * - customer: INFLOW / TRANSFER receipts
 * - vendor: OUTFLOW that looks like stock/labour/vendor-wallet spend
 * - misc: other OUTFLOW to the order (general-expense style opex)
 */
export async function loadOrderSheetPaymentGroups(
  orderId: string,
): Promise<{
  customer: OrderSheetPaymentGroup
  vendor: OrderSheetPaymentGroup
  misc: OrderSheetPaymentGroup
}> {
  const allocations = await prisma.financeAllocation.findMany({
    where: { orderId },
    select: {
      amount: true,
      transaction: {
        select: {
          id: true,
          date: true,
          direction: true,
          description: true,
          contactName: true,
          category: { select: { name: true } },
          paidThroughAccount: {
            select: { name: true, type: true, isVendorWallet: true },
          },
          transferToAccount: { select: { name: true } },
          account: { select: { name: true } },
        },
      },
    },
    orderBy: { transaction: { date: 'desc' } },
  })

  const customer: OrderSheetPaymentRow[] = []
  const vendor: OrderSheetPaymentRow[] = []
  const misc: OrderSheetPaymentRow[] = []

  for (const a of allocations) {
    const t = a.transaction
    const amount = roundMoney(Number(a.amount))
    const catName = t.category?.name ?? null
    const paidName = t.paidThroughAccount.name
    const flowLabel =
      t.direction === 'TRANSFER'
        ? `Transfer · ${paidName}${t.transferToAccount ? ` → ${t.transferToAccount.name}` : ''}`
        : t.direction === 'INFLOW'
          ? `Inflow · ${paidName}`
          : `Outflow · ${paidName}`

    const row: OrderSheetPaymentRow = {
      id: t.id,
      date: t.date.toISOString(),
      amount,
      direction: t.direction,
      label: flowLabel,
      description: (t.description || t.contactName || '').trim(),
      categoryName: catName,
      href: `/admin/finance/transactions?edit=${encodeURIComponent(t.id)}`,
    }

    if (isOrderReceiptDirection(t.direction)) {
      customer.push(row)
      continue
    }
    if (t.direction === 'OUTFLOW') {
      if (
        isVendorOutflow({
          categoryName: catName,
          paidThroughType: t.paidThroughAccount.type,
          paidThroughIsVendor: t.paidThroughAccount.isVendorWallet,
        })
      ) {
        vendor.push(row)
      } else {
        misc.push(row)
      }
    }
  }

  const group = (rows: OrderSheetPaymentRow[]): OrderSheetPaymentGroup => ({
    rows,
    total: roundMoney(rows.reduce((s, r) => s + r.amount, 0)),
  })

  return {
    customer: group(customer),
    vendor: group(vendor),
    misc: group(misc),
  }
}
