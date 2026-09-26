import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  canManageTargetRole,
  getEnvAdminEmails,
  getEnvFinanceEmails,
  getDynamicRoleAssignments,
  type UserRole,
  getEffectiveRole,
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

    if (assignmentMap.has(lowerEmail)) {
      effectiveRole = assignmentMap.get(lowerEmail)!
    } else if (envFinances.includes(lowerEmail)) {
      effectiveRole = 'FINANCE'
    } else if (envAdmins.includes(lowerEmail)) {
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

  // Merge any assignments that aren't yet in dbUsers so they display immediately
  const knownEmails = new Set(dbUsers.map((u) => u.email.toLowerCase()))
  for (const a of assignments) {
    const lower = a.email.toLowerCase()
    if (!knownEmails.has(lower) && (a.role === 'ADMIN' || a.role === 'FINANCE')) {
      initialUsers.unshift({
        id: a.id,
        name: a.email.split('@')[0],
        email: a.email,
        mobile: null,
        role: a.role,
        createdAt: a.createdAt,
        orderCount: 0,
        isEnvAdmin: envAdmins.includes(lower),
        isEnvFinance: envFinances.includes(lower),
        canManage: canManageTargetRole(callerRole, a.role),
      })
      knownEmails.add(lower)
    }
  }

  // Build role email lists
  const userMap = new Map(dbUsers.map((u) => [u.email.toLowerCase(), u]))

  const initialAdminEmails: RoleEmailEntry[] = []
  const initialFinanceEmails: RoleEmailEntry[] = []

  // Add all dynamic assignments first
  for (const a of assignments) {
    const lower = a.email.toLowerCase()
    const u = userMap.get(lower)
    if (a.role === 'FINANCE') {
      initialFinanceEmails.push({
        id: a.id,
        email: lower,
        source: envFinances.includes(lower) ? 'env' : 'database',
        name: u?.name,
        userId: u?.id,
        createdBy: a.createdBy,
        createdAt: a.createdAt,
        isRemovable: callerRole === 'FINANCE',
      })
    } else if (a.role === 'ADMIN') {
      initialAdminEmails.push({
        id: a.id,
        email: lower,
        source: envAdmins.includes(lower) ? 'env' : 'database',
        name: u?.name,
        userId: u?.id,
        createdBy: a.createdBy,
        createdAt: a.createdAt,
        isRemovable: true,
      })
    }
  }

  // Add env finance emails that are not dynamically overridden
  for (const email of envFinances) {
    if (!assignmentMap.has(email)) {
      const u = userMap.get(email)
      initialFinanceEmails.push({
        email,
        source: 'env',
        name: u?.name,
        userId: u?.id,
        createdAt: u?.createdAt.toISOString(),
        isRemovable: callerRole === 'FINANCE',
      })
    }
  }

  // Add env admin emails that are not dynamically overridden
  for (const email of envAdmins) {
    if (!assignmentMap.has(email)) {
      const u = userMap.get(email)
      adminList_push: {
        initialAdminEmails.push({
          email,
          source: 'env',
          name: u?.name,
          userId: u?.id,
          createdAt: u?.createdAt.toISOString(),
          isRemovable: true,
        })
      }
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
