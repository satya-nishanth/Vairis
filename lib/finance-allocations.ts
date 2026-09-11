import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  type FinanceAllocationInput,
  validateAllocationInputs,
} from '@/lib/finance-transaction-serialize'

/** Validate targets exist and return normalized allocation rows + order ids to sync. */
export async function prepareAllocations(
  allocations: FinanceAllocationInput[],
  txAmount: number,
): Promise<{ error: string } | { rows: { amount: number; orderId: string | null; purchaseBillId: string | null }[]; orderIds: string[] }> {
  const err = validateAllocationInputs(allocations, txAmount)
  if (err) return { error: err }

  const orderIds = [...new Set(allocations.map((a) => a.orderId).filter(Boolean) as string[])]
  const billIds = [...new Set(allocations.map((a) => a.purchaseBillId).filter(Boolean) as string[])]

  if (orderIds.length) {
    const found = await prisma.order.count({ where: { id: { in: orderIds } } })
    if (found !== orderIds.length) return { error: 'One or more orders not found' }
  }
  if (billIds.length) {
    const found = await prisma.purchaseBill.count({ where: { id: { in: billIds } } })
    if (found !== billIds.length) return { error: 'One or more purchase bills not found' }
  }

  return {
    rows: allocations.map((a) => ({
      amount: a.amount,
      orderId: a.orderId ?? null,
      purchaseBillId: a.purchaseBillId ?? null,
    })),
    orderIds,
  }
}

export function allocationCreateNested(
  rows: { amount: number; orderId: string | null; purchaseBillId: string | null }[],
): Prisma.FinanceAllocationCreateWithoutTransactionInput[] {
  return rows.map((r) => ({
    amount: r.amount,
    orderId: r.orderId ?? undefined,
    purchaseBillId: r.purchaseBillId ?? undefined,
  }))
}
