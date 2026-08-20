import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { istMonthUtcRange, summarizeFinance, type ExpenseRow, type OrderSheetRow } from '@/lib/finance'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error

  const monthParam = req.nextUrl.searchParams.get('month') // YYYY-MM
  let range: { start: Date; end: Date } | undefined
  if (monthParam) {
    const m = /^(\d{4})-(\d{2})$/.exec(monthParam)
    if (!m) return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
    range = istMonthUtcRange(Number(m[1]), Number(m[2]))
  }

  const [expenses, sheets] = await Promise.all([
    prisma.generalExpense.findMany(),
    prisma.orderFinance.findMany({ include: { order: { select: { createdAt: true } } } }),
  ])

  const expenseRows: ExpenseRow[] = expenses.map((e) => ({
    date: e.date,
    amount: Number(e.amount),
    paidThrough: e.paidThrough,
    contributor: e.contributor,
  }))
  const sheetRows: OrderSheetRow[] = sheets.map((s) => ({
    orderCreatedAt: s.order.createdAt,
    goldCost: Number(s.goldCost),
    diamondCost: Number(s.diamondCost),
    stonesCost: Number(s.stonesCost),
    sellingPrice: Number(s.sellingPrice),
    customerPaidTo: s.customerPaidTo,
  }))

  return NextResponse.json(summarizeFinance(expenseRows, sheetRows, range))
}
