import { prisma } from '@/lib/prisma'
import { istYearMonth, istQuarter } from '@/lib/finance'
import { FinanceReportsClient } from '@/components/admin/FinanceReportsClient'

export const dynamic = 'force-dynamic'

export default async function FinanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; quarter?: string; period?: string }>
}) {
  const sp = await searchParams
  const nowYm = istYearMonth(new Date())
  const nowQ = istQuarter(new Date())
  const periodAll = sp.period === 'all'
  const quarterMatch = sp.quarter?.match(/^(\d{4})-([1-4])$/)
  const yearOnly = !quarterMatch && sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : null
  const monthValue =
    sp.month && /^\d{4}-\d{2}$/.test(sp.month)
      ? sp.month
      : `${nowYm.year}-${String(nowYm.month).padStart(2, '0')}`
  const quarterValue = quarterMatch
    ? `${quarterMatch[1]}-${quarterMatch[2]}`
    : `${nowQ.year}-${nowQ.quarter}`

  const mode: 'month' | 'quarter' | 'year' | 'all' = periodAll
    ? 'all'
    : quarterMatch
      ? 'quarter'
      : yearOnly
        ? 'year'
        : 'month'

  const transactions = await prisma.financeTransaction.findMany({
    orderBy: { date: 'desc' },
    select: {
      date: true,
      direction: true,
      amount: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  })

  return (
    <FinanceReportsClient
      initialMode={mode}
      initialMonth={monthValue}
      initialQuarter={quarterValue}
      initialYear={yearOnly ?? nowYm.year}
      transactions={transactions.map((t) => ({
        date: t.date.toISOString(),
        direction: t.direction,
        amount: Number(t.amount),
        categoryId: t.categoryId,
        categoryName: t.category?.name ?? null,
      }))}
    />
  )
}
