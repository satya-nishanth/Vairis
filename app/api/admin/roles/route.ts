import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getEffectiveRole,
  getEnvAdminEmails,
  getEnvFinanceEmails,
  getDynamicRoleAssignments,
  assignDynamicRole,
  revokeDynamicRole,
  canManageTargetRole,
} from '@/lib/roles'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/roles — retrieve all static (env) and dynamic admin & finance emails.
 */
export async function GET() {
  try {
    const authResult = await requireAdminApi()
    if (authResult.error) return authResult.error
    const { role: callerRole } = authResult

    const envAdmins = getEnvAdminEmails()
    const envFinances = getEnvFinanceEmails()

    const assignments = await getDynamicRoleAssignments()

    const allEmails = Array.from(
      new Set([...envAdmins, ...envFinances, ...assignments.map((a) => a.email.toLowerCase())]),
    )
    const users = await prisma.user.findMany({
      where: { email: { in: allEmails } },
      select: { id: true, email: true, name: true, createdAt: true },
    })
    const userMap = new Map(users.map((u) => [u.email.toLowerCase(), u]))
    const assignmentMap = new Map(assignments.map((a) => [a.email.toLowerCase(), a]))

    const adminList: Array<{
      email: string
      source: 'env' | 'database'
      id?: string
      name?: string
      userId?: string
      createdBy?: string | null
      createdAt?: string
      isRemovable: boolean
    }> = []

    const financeList: Array<{
      email: string
      source: 'env' | 'database'
      id?: string
      name?: string
      userId?: string
      createdBy?: string | null
      createdAt?: string
      isRemovable: boolean
    }> = []

    // 1. Process dynamic assignments (dashboard-assigned roles take precedence)
    for (const a of assignments) {
      const lower = a.email.toLowerCase()
      const user = userMap.get(lower)

      if (a.role === 'FINANCE') {
        financeList.push({
          id: a.id,
          email: lower,
          source: envFinances.includes(lower) ? 'env' : 'database',
          name: user?.name,
          userId: user?.id,
          createdBy: a.createdBy,
          createdAt: a.createdAt,
          isRemovable: callerRole === 'FINANCE',
        })
      } else if (a.role === 'ADMIN') {
        adminList.push({
          id: a.id,
          email: lower,
          source: envAdmins.includes(lower) ? 'env' : 'database',
          name: user?.name,
          userId: user?.id,
          createdBy: a.createdBy,
          createdAt: a.createdAt,
          isRemovable: true,
        })
      }
      // Note: role === 'USER' means explicitly revoked, so not shown in either list
    }

    // 2. Add env finance emails that have not been dynamically modified
    for (const email of envFinances) {
      if (!assignmentMap.has(email)) {
        const user = userMap.get(email)
        financeList.push({
          email,
          source: 'env',
          name: user?.name,
          userId: user?.id,
          createdAt: user?.createdAt.toISOString(),
          isRemovable: callerRole === 'FINANCE',
        })
      }
    }

    // 3. Add env admin emails that have not been dynamically modified
    for (const email of envAdmins) {
      if (!assignmentMap.has(email)) {
        const user = userMap.get(email)
        adminList.push({
          email,
          source: 'env',
          name: user?.name,
          userId: user?.id,
          createdAt: user?.createdAt.toISOString(),
          isRemovable: true,
        })
      }
    }

    return NextResponse.json({
      callerRole,
      adminList,
      financeList,
    })
  } catch (err: unknown) {
    console.error('[GET /api/admin/roles] Error:', err)
    const msg = err instanceof Error ? err.message : 'Internal server error while fetching roles'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

const addRoleSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(200),
  role: z.enum(['ADMIN', 'FINANCE']),
})

/**
 * POST /api/admin/roles — assign ADMIN or FINANCE role to an email.
 * Delegation check:
 * - Finance caller can assign ADMIN or FINANCE.
 * - Admin caller can ONLY assign ADMIN. Admin cannot assign FINANCE.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminApi()
    if (authResult.error) return authResult.error
    const { session, role: callerRole } = authResult

    const parsed = addRoleSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      )
    }

    const { role } = parsed.data
    const email = parsed.data.email.toLowerCase()

    // Delegation rule
    if (role === 'FINANCE' && callerRole !== 'FINANCE') {
      return NextResponse.json(
        {
          error:
            'Forbidden: Admins cannot grant Finance permissions. Only Finance users can assign Finance permissions.',
        },
        { status: 403 },
      )
    }

    const assignment = await assignDynamicRole(email, role, session.user.email)

    return NextResponse.json(
      {
        success: true,
        assignment,
        message: `Successfully granted ${role} role to ${email}.`,
      },
      { status: 201 },
    )
  } catch (err: unknown) {
    console.error('[POST /api/admin/roles] Error:', err)
    const msg = err instanceof Error ? err.message : 'Internal server error while assigning role'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/roles — revoke ADMIN or FINANCE role from an email.
 * Delegation check:
 * - Finance caller can revoke ADMIN or FINANCE.
 * - Admin caller can ONLY revoke ADMIN. Admin cannot revoke FINANCE.
 */
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAdminApi()
    if (authResult.error) return authResult.error
    const { role: callerRole } = authResult

    const body = await req.json().catch(() => ({}))
    const emailParam = req.nextUrl.searchParams.get('email')
    const emailRaw = (body.email ?? emailParam ?? '').toString().trim()
    const email = emailRaw.toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const currentTargetRole = await getEffectiveRole(email)
    if (currentTargetRole === 'USER') {
      return NextResponse.json({ error: 'Role assignment not found or already standard user' }, { status: 404 })
    }

    // Delegation rule
    if (currentTargetRole === 'FINANCE' && callerRole !== 'FINANCE') {
      return NextResponse.json(
        {
          error:
            'Forbidden: Admins cannot revoke Finance permissions. Only Finance users can revoke Finance permissions.',
        },
        { status: 403 },
      )
    }

    await revokeDynamicRole(email)

    return NextResponse.json({
      success: true,
      message: `Role ${currentTargetRole} revoked from ${email}.`,
    })
  } catch (err: unknown) {
    console.error('[DELETE /api/admin/roles] Error:', err)
    const msg = err instanceof Error ? err.message : 'Internal server error while revoking role'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
