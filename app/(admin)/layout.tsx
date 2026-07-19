import { requireAdmin } from '@/lib/auth'
import { AdminSidebar } from './AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <main className="admin-shell__main">{children}</main>
    </div>
  )
}
