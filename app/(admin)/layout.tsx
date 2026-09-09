import { requireAdmin } from '@/lib/auth'
import { isFinanceEmail } from '@/lib/finance-auth'
import { AdminSidebar } from './AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()

  return (
    <div className="admin-shell">
      <AdminSidebar showFinance={isFinanceEmail(session.user.email)} />
      <main className="admin-shell__main">{children}</main>
    </div>
  )
}
