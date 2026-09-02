import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeReportDateRange, parseFinanceReportSearchParams } from '@/lib/finance'
import { buildTransactionsXlsx } from '@/lib/finance-transaction-export'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error

  const period = parseFinanceReportSearchParams(req.nextUrl.searchParams)
  const { start, end, fileLabel } = financeReportDateRange(period)

  const rows = await prisma.financeTransaction.findMany({
    where: start && end ? { date: { gte: start, lt: end } } : undefined,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: {
      account: { select: { name: true } },
      paidThroughAccount: { select: { name: true } },
      transferToAccount: { select: { name: true } },
      category: { select: { name: true } },
      contact: { select: { name: true } },
      orders: { select: { orderId: true } },
    },
  })

  const buffer = buildTransactionsXlsx(
    rows.map((r) => ({
      id: r.id,
      date: r.date,
      direction: r.direction,
      amount: Number(r.amount),
      description: r.description,
      accountName: r.account?.name ?? null,
      paidThroughAccountName: r.paidThroughAccount?.name ?? null,
      transferToAccountName: r.transferToAccount?.name ?? null,
      categoryName: r.category?.name ?? null,
      contactName: r.contactName || r.contact?.name || null,
      autoCreated: r.autoCreated,
      reviewComplete: r.reviewComplete,
      unlinkedOrderLabels: r.unlinkedOrderLabels,
      orderIds: r.orders.map((o) => o.orderId),
    })),
  )

  const filename = `vairis-transactions-${fileLabel}.xlsx`
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
