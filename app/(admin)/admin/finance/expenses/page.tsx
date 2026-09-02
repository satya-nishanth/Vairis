import { prisma } from '@/lib/prisma'
import { defaultFinanceAccountId, requireFinance } from '@/lib/finance-auth'
import { ExpenseManager } from '@/components/admin/ExpenseManager'

export const dynamic = 'force-dynamic'

export default async function FinanceExpensesPage() {
  const session = await requireFinance()
  const [rows, accounts, defaultAccountId] = await Promise.all([
    prisma.generalExpense.findMany({
      orderBy: { date: 'desc' },
      include: { account: { select: { id: true, name: true } } },
    }),
    prisma.financeAccount.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    defaultFinanceAccountId(session.user.email),
  ])

  return (
    <ExpenseManager
      defaultAccountId={defaultAccountId}
      accounts={accounts}
      initial={rows.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        description: r.description,
        amount: Number(r.amount),
        paidThrough: r.paidThrough,
        accountId: r.accountId,
        accountName: r.account?.name ?? null,
      }))}
    />
  )
}
