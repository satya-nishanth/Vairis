import { prisma } from '@/lib/prisma'
import { toFinanceCategoryDirection } from '@/lib/finance'
import { getFinanceKpiSettings } from '@/lib/finance-settings'
import { FinanceConfigClient } from '@/components/admin/FinanceConfigClient'

export const dynamic = 'force-dynamic'

export default async function FinanceConfigPage() {
  const [accounts, contacts, categories, kpiSettings] = await Promise.all([
    prisma.financeAccount.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.financeContact.findMany({ orderBy: { name: 'asc' } }),
    prisma.financeCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    getFinanceKpiSettings(),
  ])

  return (
    <FinanceConfigClient
      accounts={accounts.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        type: a.type,
        isVendorWallet: a.isVendorWallet,
        vendorOutflowSource: a.vendorOutflowSource,
        vaultPurityK: a.vaultPurityK,
        active: a.active,
        sortOrder: a.sortOrder,
      }))}
      contacts={contacts.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        email: c.email,
        phone: c.phone,
        notes: c.notes,
        active: c.active,
      }))}
      categories={categories
        .filter((c) => c.direction === 'INFLOW' || c.direction === 'OUTFLOW')
        .map((c) => ({
          id: c.id,
          name: c.name,
          direction: toFinanceCategoryDirection(c.direction),
          active: c.active,
          sortOrder: c.sortOrder,
        }))}
      kpiSettings={kpiSettings}
    />
  )
}
