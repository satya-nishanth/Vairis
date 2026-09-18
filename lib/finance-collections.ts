import { prisma } from '@/lib/prisma'
import { roundMoney, sumCollectedByOrderId } from '@/lib/finance'
import {
  orderExpectedAmount,
  orderPaymentStatus,
  settlementStatus,
  type SettlementStatus,
} from '@/lib/finance-settlement'

function sumByOrderId(
  rows: { orderId: string | null; amount: { toString(): string } | number }[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (!r.orderId) continue
    map.set(r.orderId, roundMoney((map.get(r.orderId) ?? 0) + Number(r.amount)))
  }
  return map
}

/**
 * Customer receipts toward orders: INFLOW + TRANSFER allocations.
 * When a TRANSFER→COMPANY_BANK (Vairis bank) exists for an order, INFLOW is
 * ignored for that order so settle does not double-count.
 */
export async function collectedByOrderIds(
  orderIds: string[],
  opts?: { excludeTransactionId?: string },
): Promise<Map<string, number>> {
  if (!orderIds.length) return new Map()
  const rows = await prisma.financeAllocation.findMany({
    where: {
      orderId: { in: orderIds },
      transaction: {
        direction: { in: ['INFLOW', 'TRANSFER'] },
        ...(opts?.excludeTransactionId
          ? { id: { not: opts.excludeTransactionId } }
          : {}),
      },
    },
    select: {
      orderId: true,
      amount: true,
      transaction: {
        select: {
          direction: true,
          transferToAccount: { select: { type: true } },
        },
      },
    },
  })
  return sumCollectedByOrderId(
    rows
      .filter((r): r is typeof r & { orderId: string } => Boolean(r.orderId))
      .map((r) => ({
        orderId: r.orderId,
        amount: Number(r.amount),
        direction: r.transaction.direction as 'INFLOW' | 'TRANSFER',
        transferToCompanyBank:
          r.transaction.direction === 'TRANSFER' &&
          r.transaction.transferToAccount?.type === 'COMPANY_BANK',
      })),
  )
}

/**
 * Amount that has landed in a COMPANY_BANK wallet for these orders:
 * INFLOW paid-through company bank, or TRANSFER whose destination is company bank.
 */
export async function settledInCompanyBankByOrderIds(
  orderIds: string[],
  opts?: { excludeTransactionId?: string },
): Promise<Map<string, number>> {
  if (!orderIds.length) return new Map()
  const exclude = opts?.excludeTransactionId
    ? { id: { not: opts.excludeTransactionId } }
    : {}
  const rows = await prisma.financeAllocation.findMany({
    where: {
      orderId: { in: orderIds },
      OR: [
        {
          transaction: {
            direction: 'INFLOW',
            paidThroughAccount: { type: 'COMPANY_BANK' },
            ...exclude,
          },
        },
        {
          transaction: {
            direction: 'TRANSFER',
            transferToAccount: { type: 'COMPANY_BANK' },
            ...exclude,
          },
        },
      ],
    },
    select: { orderId: true, amount: true },
  })
  return sumByOrderId(rows)
}

export async function collectedByPurchaseBillIds(
  billIds: string[],
  opts?: { excludeTransactionId?: string },
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (!billIds.length) return map
  const rows = await prisma.financeAllocation.groupBy({
    by: ['purchaseBillId'],
    where: {
      purchaseBillId: { in: billIds },
      ...(opts?.excludeTransactionId
        ? { transactionId: { not: opts.excludeTransactionId } }
        : {}),
    },
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
  /** Amount already in a COMPANY_BANK account for this order (INFLOW or TRANSFER-to). */
  settledInCompanyBank?: number
  /** Sheet marked settled manually (with note) — skips company-bank gate when fully paid. */
  manuallySettled?: boolean
}): OrderPaymentSummary {
  const expected = orderExpectedAmount({
    grandTotal: opts.grandTotal,
    sheetSelling: opts.sheetSelling,
  })
  const collected = roundMoney(opts.collected)
  const settledInCompanyBank = roundMoney(opts.settledInCompanyBank ?? 0)
  return {
    expected,
    collected,
    balance: roundMoney(expected - collected),
    paymentStatus: orderPaymentStatus(expected, collected, settledInCompanyBank, {
      manuallySettled: Boolean(opts.manuallySettled),
    }),
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
