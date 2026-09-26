import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { CustomersManager } from '@/components/admin/CustomersManager'

import Link from 'next/link'

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', margin: 0 }}>
          Customers
        </h1>
        <Link
          href="/admin/users"
          style={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            padding: '6px 12px',
            backgroundColor: '#111827',
            color: '#ffffff',
            borderRadius: '4px',
            textDecoration: 'none',
          }}
        >
          Manage Roles & Passwords →
        </Link>
      </div>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 0, marginBottom: '1.5rem' }}>
        Site accounts used for manual orders, My Orders, and track-order. For role administration, password creation, and admin/finance whitelist management, use{' '}
        <Link href="/admin/users" style={{ color: '#2563eb', textDecoration: 'underline' }}>
          Users & Roles
        </Link>
        .
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
