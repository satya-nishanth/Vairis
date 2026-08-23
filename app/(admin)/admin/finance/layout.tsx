import { requireFinance } from '@/lib/finance-auth'
import { FinanceSubnav } from '@/components/admin/FinanceSubnav'

export const dynamic = 'force-dynamic'

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireFinance()
  return (
    <div className="admin-page admin-page--finance">
      <h1 className="admin-page__title" style={{ marginBottom: 8 }}>
        Finance
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 0, marginBottom: 16 }}>
        Private ledger. Accounts and contacts are managed under Config.
      </p>
      <FinanceSubnav />
      {children}
    </div>
  )
}
