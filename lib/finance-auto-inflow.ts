import type { Prisma } from '@prisma/client'

import { shortFinanceId } from '@/lib/finance'

/** Seeded company wallet — see prisma/migrations/20260822180000_finance_accounts_transactions */
export const FINANCE_VAIRIS_BANK_ID = 'fa_vairis_bank'
/** Seeded inflow category — see prisma/migrations/20260823100000_finance_categories */
export const FINANCE_CUSTOMER_PAYMENT_CATEGORY_ID = 'fc_customer'

/**
 * Create a cashbook INFLOW when an online order payment is confirmed.
 * Idempotent per order (skips if an auto-created inflow already links this order).
 * Amount = order.grandTotal (gateway charge), not order-sheet selling.
 */
export async function createAutoOrderPaymentInflow(
  tx: Prisma.TransactionClient,
  opts: {
    orderId: string
    amount: number
    contactName: string
    date?: Date
  },
): Promise<string | null> {
  const amount = Math.round(opts.amount * 100) / 100
  if (!(amount > 0)) return null

  const existing = await tx.financeTransactionOrder.findFirst({
    where: {
      orderId: opts.orderId,
      transaction: { autoCreated: true, direction: 'INFLOW' },
    },
    select: { transactionId: true },
  })
  if (existing) return existing.transactionId

  const bank =
    (await tx.financeAccount.findFirst({
      where: { id: FINANCE_VAIRIS_BANK_ID, active: true },
      select: { id: true },
    })) ??
    (await tx.financeAccount.findFirst({
      where: { name: 'Vairis Bank', active: true },
      select: { id: true },
    }))

  const category =
    (await tx.financeCategory.findFirst({
      where: { id: FINANCE_CUSTOMER_PAYMENT_CATEGORY_ID, active: true, direction: 'INFLOW' },
      select: { id: true },
    })) ??
    (await tx.financeCategory.findFirst({
      where: { name: 'Customer payment', active: true, direction: 'INFLOW' },
      select: { id: true },
    }))

  if (!bank || !category) {
    console.error(
      '[finance] auto-inflow skipped — missing Vairis Bank account or Customer payment category',
      { orderId: opts.orderId, bank: !!bank, category: !!category },
    )
    return null
  }

  const row = await tx.financeTransaction.create({
    data: {
      date: opts.date ?? new Date(),
      direction: 'INFLOW',
      amount,
      description: `Customer payment — order ${shortFinanceId(opts.orderId)}`,
      accountId: bank.id,
      paidThroughAccountId: bank.id,
      categoryId: category.id,
      contactName: opts.contactName.trim(),
      autoCreated: true,
      reviewComplete: false,
      orders: { create: [{ orderId: opts.orderId }] },
      allocations: { create: [{ orderId: opts.orderId, amount }] },
    },
    select: { id: true },
  })
  return row.id
}
