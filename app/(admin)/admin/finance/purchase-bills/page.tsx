import { prisma } from '@/lib/prisma'
import { requireFinance } from '@/lib/finance-auth'
import { toDateInput, shortFinanceId } from '@/lib/finance'
import {
  collectedByPurchaseBillIds,
  purchaseBillPaymentSummary,
} from '@/lib/finance-collections'
import { PurchaseBillsManager, type PurchaseBillRow } from '@/components/admin/PurchaseBillsManager'

export const dynamic = 'force-dynamic'

export default async function PurchaseBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ compose?: string; edit?: string }>
}) {
  await requireFinance()
  const sp = await searchParams
  const compose = sp.compose === '1'
  const editId = sp.edit && sp.edit.length > 0 ? sp.edit : null

  const [bills, contacts] = await Promise.all([
    prisma.purchaseBill.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        supplierContact: { select: { id: true, name: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.financeContact.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true },
    }),
  ])

  const paidMap = await collectedByPurchaseBillIds(bills.map((b) => b.id))

  const initial: PurchaseBillRow[] = bills.map((r) => {
    const total = Number(r.totalAmount)
    const summary = purchaseBillPaymentSummary(total, paidMap.get(r.id) ?? 0)
    return {
      id: r.id,
      billNumber: r.billNumber,
      date: r.date.toISOString(),
      dateInput: toDateInput(r.date),
      supplierContactId: r.supplierContactId,
      supplierName: r.supplierName || r.supplierContact?.name || '',
      description: r.description,
      gstAmount: Number(r.gstAmount),
      totalAmount: total,
      notes: r.notes,
      lines: r.lines.map((l) => ({
        id: l.id,
        description: l.description,
        amount: Number(l.amount),
      })),
      attachments: r.attachments.map((a) => ({
        id: a.id,
        url: a.url,
        fileName: a.fileName,
        contentType: a.contentType,
      })),
      paid: summary.paid,
      balance: summary.balance,
      paymentStatus: summary.paymentStatus,
      label: `Bill ${r.billNumber || shortFinanceId(r.id)}${
        r.supplierName || r.supplierContact?.name
          ? ` — ${r.supplierName || r.supplierContact?.name}`
          : ''
      }`,
    }
  })

  return (
    <PurchaseBillsManager
      initial={initial}
      contacts={contacts}
      compose={compose}
      editId={editId}
    />
  )
}
