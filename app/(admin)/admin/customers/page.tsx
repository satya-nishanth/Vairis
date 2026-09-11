import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { CustomersManager } from '@/components/admin/CustomersManager'

export const dynamic = 'force-dynamic'

export default async function AdminCustomersPage() {
  await requireAdmin()

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    take: 1000,
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  })

  return (
    <div className="admin-page" style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Customers
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 0, marginBottom: '1.5rem' }}>
        Site accounts used for manual orders, My Orders, and track-order. Separate from the Contacts
        inbox (storefront form) and Finance contacts.
      </p>
      <CustomersManager
        initial={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          mobile: u.mobile,
          createdAt: u.createdAt.toISOString(),
          orderCount: u._count.orders,
        }))}
      />
    </div>
  )
}
