import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { istMonthUtcRange, summarizeFinance, sheetTotals, type ExpenseRow, type OrderSheetRow } from '@/lib/finance'

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

  const [expenses, sheets, accounts] = await Promise.all([
    prisma.generalExpense.findMany(),
    prisma.orderFinance.findMany({ include: { order: { select: { createdAt: true } }, lines: true } }),
    prisma.financeAccount.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ])

  const expenseRows: ExpenseRow[] = expenses.map((e) => ({
    date: e.date,
    amount: Number(e.amount),
    paidThrough: e.paidThrough,
    accountId: e.accountId,
  }))
  const sheetRows: OrderSheetRow[] = sheets.map((s) => {
    const totals = sheetTotals(
      s.lines.map((l) => ({
        kind: l.kind,
        costPrice: Number(l.costPrice),
        sellingPrice: Number(l.sellingPrice),
      })),
    )
    return {
      orderCreatedAt: s.order.createdAt,
      cost: totals.cost,
      sellingPrice: totals.selling,
      paidToAccountId: s.paidToAccountId,
    }
  })

  return NextResponse.json(
    summarizeFinance(
      expenseRows,
      sheetRows,
      accounts.map((a) => ({ id: a.id, name: a.name, type: a.type })),
      range,
    ),
  )
}
