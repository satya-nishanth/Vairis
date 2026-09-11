import type { Prisma } from '@prisma/client'
import { roundMoney, shortFinanceId, toFinanceTransactionDirection } from '@/lib/finance'
import { txAllocationStatus } from '@/lib/finance-tx-allocation-status'

export const financeTransactionInclude = {
  account: { select: { id: true, name: true } },
  paidThroughAccount: { select: { id: true, name: true } },
  transferToAccount: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  contact: { select: { id: true, name: true } },
  orders: { include: { order: { select: { id: true, contactName: true } } } },
  inventoryItems: {
    include: {
      inventoryItem: {
        select: {
          id: true,
          customName: true,
          product: { select: { name: true, itemCode: true } },
          variant: { select: { sku: true } },
        },
      },
    },
  },
  allocations: {
    include: {
      order: { select: { id: true, contactName: true } },
      purchaseBill: { select: { id: true, billNumber: true, supplierName: true, totalAmount: true } },
    },
  },
} satisfies Prisma.FinanceTransactionInclude

export type FinanceAllocationInput = {
  amount: number
  orderId?: string | null
  purchaseBillId?: string | null
}

export function serializeFinanceTransaction(row: {
  id: string
  date: Date
  direction: string
  amount: { toString(): string } | number
  gstAmount?: { toString(): string } | number
  description: string
  accountId: string
  paidThroughAccountId: string
  transferToAccountId: string | null
  categoryId: string | null
  contactId: string | null
  contactName: string
  autoCreated: boolean
  reviewComplete: boolean
  unlinkedOrderLabels: string[]
  unlinkedInventoryLabels?: string[]
  createdAt: Date
  updatedAt: Date
  account?: { id: string; name: string }
  paidThroughAccount?: { id: string; name: string }
  transferToAccount?: { id: string; name: string } | null
  category?: { id: string; name: string } | null
  contact?: { id: string; name: string } | null
  orders?: { orderId: string; order: { id: string; contactName: string } }[]
  inventoryItems?: {
    inventoryItemId: string
    inventoryItem: {
      id: string
      customName: string | null
      product: { name: string; itemCode: string | null } | null
      variant: { sku: string } | null
    }
  }[]
  allocations?: {
    id: string
    amount: { toString(): string } | number
    orderId: string | null
    purchaseBillId: string | null
    order?: { id: string; contactName: string } | null
    purchaseBill?: {
      id: string
      billNumber: string
      supplierName: string
      totalAmount: { toString(): string } | number
    } | null
  }[]
}) {
  const allocated = roundMoney(
    (row.allocations ?? []).reduce((s, a) => s + Number(a.amount), 0),
  )
  const amount = Number(row.amount)
  const allocMeta = txAllocationStatus(amount, allocated)
  return {
    id: row.id,
    date: row.date.toISOString(),
    direction: toFinanceTransactionDirection(row.direction),
    amount,
    gstAmount: Number(row.gstAmount ?? 0),
    description: row.description,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    paidThroughAccountId: row.paidThroughAccountId,
    paidThroughAccountName: row.paidThroughAccount?.name ?? null,
    transferToAccountId: row.transferToAccountId,
    transferToAccountName: row.transferToAccount?.name ?? null,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    contactId: row.contactId,
    contactName: row.contactName || row.contact?.name || null,
    autoCreated: row.autoCreated,
    reviewComplete: row.reviewComplete,
    unlinkedOrderLabels: row.unlinkedOrderLabels ?? [],
    unlinkedInventoryLabels: row.unlinkedInventoryLabels ?? [],
    orderIds: row.orders?.map((o) => o.orderId) ?? [],
    orders:
      row.orders?.map((o) => ({
        id: o.order.id,
        contactName: o.order.contactName,
      })) ?? [],
    inventoryItemIds: row.inventoryItems?.map((l) => l.inventoryItemId) ?? [],
    inventoryItems:
      row.inventoryItems?.map((l) => ({
        id: l.inventoryItem.id,
        label:
          l.inventoryItem.customName ||
          l.inventoryItem.product?.name ||
          l.inventoryItem.variant?.sku ||
          l.inventoryItem.id.slice(-8),
      })) ?? [],
    allocations: (row.allocations ?? []).map((a) => ({
      id: a.id,
      amount: Number(a.amount),
      orderId: a.orderId,
      purchaseBillId: a.purchaseBillId,
      label: a.order
        ? `Order ${shortFinanceId(a.order.id)}${a.order.contactName ? ` — ${a.order.contactName}` : ''}`
        : a.purchaseBill
          ? `Bill ${a.purchaseBill.billNumber || shortFinanceId(a.purchaseBill.id)}${
              a.purchaseBill.supplierName ? ` — ${a.purchaseBill.supplierName}` : ''
            }`
          : 'Allocation',
      href: a.orderId
        ? `/admin/finance/orders?orderId=${a.orderId}`
        : a.purchaseBillId
          ? `/admin/finance/purchase-bills?edit=${a.purchaseBillId}`
          : null,
    })),
    allocatedAmount: allocated,
    unallocatedAmount: allocMeta.unallocatedAmount,
    overAllocatedAmount: allocMeta.overAllocatedAmount,
    allocationStatus: allocMeta.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function validateAllocationInputs(
  allocations: FinanceAllocationInput[],
  txAmount: number,
): string | null {
  if (allocations.length === 0) return null
  let sum = 0
  for (const a of allocations) {
    const hasOrder = Boolean(a.orderId)
    const hasBill = Boolean(a.purchaseBillId)
    if (hasOrder === hasBill) {
      return 'Each allocation must target either an order or a purchase bill'
    }
    if (!(a.amount > 0)) return 'Allocation amounts must be greater than 0'
    sum += a.amount
  }
  // Allow over-allocating cash slightly for rounding; hard stop still at txn amount.
  // Document overpayment (alloc > bill/order balance) is allowed and shows Overpaid on the doc.
  if (roundMoney(sum) > roundMoney(txAmount) + 0.009) {
    return 'Allocated total cannot exceed transaction amount'
  }
  return null
}
