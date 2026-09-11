import { prisma } from '@/lib/prisma'
import { roundMoney } from '@/lib/finance'
import {
  orderExpectedAmount,
  settlementStatus,
  type SettlementStatus,
} from '@/lib/finance-settlement'

export async function collectedByOrderIds(orderIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (!orderIds.length) return map
  const rows = await prisma.financeAllocation.groupBy({
    by: ['orderId'],
    where: { orderId: { in: orderIds } },
    _sum: { amount: true },
  })
  for (const r of rows) {
    if (r.orderId) map.set(r.orderId, roundMoney(Number(r._sum.amount ?? 0)))
  }
  return map
}

export async function collectedByPurchaseBillIds(billIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (!billIds.length) return map
  const rows = await prisma.financeAllocation.groupBy({
    by: ['purchaseBillId'],
    where: { purchaseBillId: { in: billIds } },
    _sum: { amount: true },
  })
  for (const r of rows) {
    if (r.purchaseBillId) map.set(r.purchaseBillId, roundMoney(Number(r._sum.amount ?? 0)))
  }
  return map
}

export type OrderPaymentSummary = {
  expected: number
  collected: number
  balance: number
  paymentStatus: SettlementStatus
}

export function orderPaymentSummary(opts: {
  grandTotal: number
  sheetSelling: number | null | undefined
  collected: number
}): OrderPaymentSummary {
  const expected = orderExpectedAmount({
    grandTotal: opts.grandTotal,
    sheetSelling: opts.sheetSelling,
  })
  const collected = roundMoney(opts.collected)
  return {
    expected,
    collected,
    balance: roundMoney(expected - collected),
    paymentStatus: settlementStatus(expected, collected),
  }
}

export type PurchaseBillPaymentSummary = {
  total: number
  paid: number
  balance: number
  paymentStatus: SettlementStatus
}

export function purchaseBillPaymentSummary(total: number, paid: number): PurchaseBillPaymentSummary {
  const t = roundMoney(total)
  const p = roundMoney(paid)
  return {
    total: t,
    paid: p,
    balance: roundMoney(t - p),
    paymentStatus: settlementStatus(t, p),
  }
}
