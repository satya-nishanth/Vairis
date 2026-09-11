import { prisma } from '@/lib/prisma'
import { defaultFinanceAccountId, requireFinance } from '@/lib/finance-auth'
import { toFinanceCategoryDirection } from '@/lib/finance'
import { financeTransactionInclude, serializeFinanceTransaction } from '@/lib/finance-transaction-serialize'
import { FinanceTransactionsManager } from '@/components/admin/FinanceTransactionsManager'

export const dynamic = 'force-dynamic'

export default async function FinanceTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ compose?: string; edit?: string }>
}) {
  const session = await requireFinance()
  const sp = await searchParams
  const compose = sp.compose === '1'
  const editId = sp.edit && sp.edit.length > 0 ? sp.edit : null

  const [rows, accounts, contacts, categories, defaultAccountId] = await Promise.all([
    prisma.financeTransaction.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: financeTransactionInclude,
    }),
    prisma.financeAccount.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.financeContact.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true },
    }),
    prisma.financeCategory.findMany({
      where: { active: true },
      orderBy: [{ direction: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, direction: true },
    }),
    defaultFinanceAccountId(session.user.email),
  ])

  return (
    <FinanceTransactionsManager
      defaultAccountId={defaultAccountId}
      accounts={accounts}
      contacts={contacts}
      categories={categories
        .filter((c) => c.direction === 'INFLOW' || c.direction === 'OUTFLOW')
        .map((c) => ({
          id: c.id,
          name: c.name,
          direction: toFinanceCategoryDirection(c.direction),
        }))}
      compose={compose}
      editId={editId}
      initial={rows.map(serializeFinanceTransaction)}
    />
  )
}
