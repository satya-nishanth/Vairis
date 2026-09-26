import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getEffectiveRole,
  canManageTargetRole,
  getEnvAdminEmails,
  getEnvFinanceEmails,
  getDynamicRoleAssignments,
  type UserRole,
} from '@/lib/roles'
import { UsersManager, UserRow, RoleEmailEntry } from '@/components/admin/UsersManager'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const session = await requireAdmin()
  const callerRole = await getEffectiveRole(session.user.email)
  const callerEmail = session.user.email ?? ''

  const envAdmins = getEnvAdminEmails()
  const envFinances = getEnvFinanceEmails()

  const [dbUsers, assignments] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
    getDynamicRoleAssignments(),
  ])

  const assignmentMap = new Map(assignments.map((a) => [a.email.toLowerCase(), a.role]))

  const initialUsers: UserRow[] = dbUsers.map((u) => {
    const lowerEmail = u.email.toLowerCase()
    let effectiveRole: UserRole = 'USER'

    if (envFinances.includes(lowerEmail) || assignmentMap.get(lowerEmail) === 'FINANCE') {
      effectiveRole = 'FINANCE'
    } else if (envAdmins.includes(lowerEmail) || assignmentMap.get(lowerEmail) === 'ADMIN') {
      effectiveRole = 'ADMIN'
    }

    const isEnvAdmin = envAdmins.includes(lowerEmail)
    const isEnvFinance = envFinances.includes(lowerEmail)
    const canManage = canManageTargetRole(callerRole, effectiveRole)

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      mobile: u.mobile,
      role: effectiveRole,
      createdAt: u.createdAt.toISOString(),
      orderCount: u._count.orders,
      isEnvAdmin,
      isEnvFinance,
      canManage,
    }
  })

  // Build admin email entries
  const userMap = new Map(dbUsers.map((u) => [u.email.toLowerCase(), u]))

  const initialAdminEmails: RoleEmailEntry[] = []
  for (const email of envAdmins) {
    const u = userMap.get(email)
    initialAdminEmails.push({
      email,
      source: 'env',
      name: u?.name,
      userId: u?.id,
      createdAt: u?.createdAt.toISOString(),
      isRemovable: false,
    })
  }
  for (const a of assignments) {
    if (a.role === 'ADMIN' && !envAdmins.includes(a.email.toLowerCase())) {
      const u = userMap.get(a.email.toLowerCase())
      initialAdminEmails.push({
        id: a.id,
        email: a.email.toLowerCase(),
        source: 'database',
        name: u?.name,
        userId: u?.id,
        createdBy: a.createdBy,
        createdAt: a.createdAt,
        isRemovable: true,
      })
    }
  }

  // Build finance email entries
  const initialFinanceEmails: RoleEmailEntry[] = []
  for (const email of envFinances) {
    const u = userMap.get(email)
    initialFinanceEmails.push({
      email,
      source: 'env',
      name: u?.name,
      userId: u?.id,
      createdAt: u?.createdAt.toISOString(),
      isRemovable: false,
    })
  }
  for (const a of assignments) {
    if (a.role === 'FINANCE' && !envFinances.includes(a.email.toLowerCase())) {
      const u = userMap.get(a.email.toLowerCase())
      initialFinanceEmails.push({
        id: a.id,
        email: a.email.toLowerCase(),
        source: 'database',
        name: u?.name,
        userId: u?.id,
        createdBy: a.createdBy,
        createdAt: a.createdAt,
        isRemovable: callerRole === 'FINANCE',
      })
    }
  }

  return (
    <div className="admin-page">
      <UsersManager
        initialUsers={initialUsers}
        initialAdminEmails={initialAdminEmails}
        initialFinanceEmails={initialFinanceEmails}
        callerRole={callerRole}
        callerEmail={callerEmail}
      />
    </div>
  )
}
