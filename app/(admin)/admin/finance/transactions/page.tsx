import { prisma } from '@/lib/prisma'
import { defaultFinanceAccountId, requireFinance } from '@/lib/finance-auth'
import { toFinanceCategoryDirection } from '@/lib/finance'
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
      include: {
        account: { select: { id: true, name: true } },
        paidThroughAccount: { select: { id: true, name: true } },
        transferToAccount: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
        orders: { include: { order: { select: { id: true, contactName: true } } } },
      },
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
      initial={rows.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        direction: r.direction,
        amount: Number(r.amount),
        description: r.description,
        accountId: r.accountId,
        accountName: r.account.name,
        paidThroughAccountId: r.paidThroughAccountId,
        paidThroughAccountName: r.paidThroughAccount.name,
        transferToAccountId: r.transferToAccountId,
        transferToAccountName: r.transferToAccount?.name ?? null,
        categoryId: r.categoryId,
        categoryName: r.category?.name ?? null,
        contactId: r.contactId,
        contactName: r.contactName || r.contact?.name || null,
        autoCreated: r.autoCreated,
        reviewComplete: r.reviewComplete,
        orderIds: r.orders.map((o) => o.orderId),
        unlinkedOrderLabels: r.unlinkedOrderLabels,
        orders: r.orders.map((o) => ({
          id: o.order.id,
          contactName: o.order.contactName,
        })),
      }))}
    />
  )
}
