import { prisma } from '@/lib/prisma'
import { ExpenseManager } from '@/components/admin/ExpenseManager'
import { defaultFinancePerson, requireFinance } from '@/lib/finance-auth'

export const dynamic = 'force-dynamic'

export default async function FinanceExpensesPage() {
  const session = await requireFinance()
  const rows = await prisma.generalExpense.findMany({ orderBy: { date: 'desc' } })
  return (
    <ExpenseManager
      defaultPerson={defaultFinancePerson(session.user.email ?? '')}
      initial={rows.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        description: r.description,
        amount: Number(r.amount),
        paidThrough: r.paidThrough,
        contributor: r.contributor,
      }))}
    />
  )
}
