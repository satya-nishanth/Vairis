import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireAdminApi } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getEffectiveRole,
  canManageTargetRole,
  getEnvAdminEmails,
  getEnvFinanceEmails,
  getDynamicRoleAssignments,
  assignDynamicRole,
  revokeDynamicRole,
  type UserRole,
} from '@/lib/roles'
import { setUserPassword } from '@/lib/admin-user-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users
 * - Query param `q` (without mode=management): quick 10-item search for manual order creation.
 * - Without `q` OR with `mode=management`: full user management dataset including effective roles,
 *   permissions check, and count of orders.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdminApi()
    if (authResult.error) return authResult.error
    const { role: callerRole } = authResult

    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    const mode = req.nextUrl.searchParams.get('mode')

    // Backwards-compatibility for manual order WhatsApp search
    if (q.length > 0 && mode !== 'management') {
      if (q.length < 2) return NextResponse.json([])

      const users = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, email: true, name: true, mobile: true },
        take: 10,
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json(users)
    }

    // Management dataset
    const envAdminEmails = getEnvAdminEmails()
    const envFinanceEmails = getEnvFinanceEmails()

    const whereClause: Prisma.UserWhereInput = {}
    if (q.length > 0) {
      whereClause.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { mobile: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [users, assignments] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          name: true,
          mobile: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      getDynamicRoleAssignments(),
    ])

    const assignmentMap = new Map(assignments.map((a) => [a.email.toLowerCase(), a.role]))

    const mappedUsers = users.map((u) => {
      const lowerEmail = u.email.toLowerCase()
      let effectiveRole: UserRole = 'USER'

      if (envFinanceEmails.includes(lowerEmail) || assignmentMap.get(lowerEmail) === 'FINANCE') {
        effectiveRole = 'FINANCE'
      } else if (envAdminEmails.includes(lowerEmail) || assignmentMap.get(lowerEmail) === 'ADMIN') {
        effectiveRole = 'ADMIN'
      }

      const isEnvAdmin = envAdminEmails.includes(lowerEmail)
      const isEnvFinance = envFinanceEmails.includes(lowerEmail)
      const canManage = canManageTargetRole(callerRole, effectiveRole)

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        mobile: u.mobile,
        role: effectiveRole,
        createdAt: u.createdAt.toISOString(),
        orderCount: u._count.orders,
        isEnvAdmin,
        isEnvFinance,
        canManage,
      }
    })

    return NextResponse.json({
      users: mappedUsers,
      callerRole,
      envAdminEmails,
      envFinanceEmails,
    })
  } catch (err: unknown) {
    console.error('[GET /api/admin/users] Error:', err)
    const msg = err instanceof Error ? err.message : 'Internal server error while fetching users'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

const createSchema = z.object({
  name: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email('Invalid email address').max(200),
  mobile: z.string().trim().max(10).optional().nullable(),
  role: z.enum(['USER', 'ADMIN', 'FINANCE']).optional().default('USER'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100).optional().nullable(),
})

/**
 * POST /api/admin/users — create a user, optionally assign role and password.
 * Permission boundary:
 * - Finance callers can assign USER, ADMIN, and FINANCE roles.
 * - Admin callers can only assign USER and ADMIN roles.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminApi()
    if (authResult.error) return authResult.error
    const { session, role: callerRole } = authResult

    const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      )
    }

    const role = parsed.data.role ?? 'USER'
    const email = parsed.data.email.toLowerCase()
    const name = parsed.data.name?.trim() || email.split('@')[0]
    const mobileRaw = (parsed.data.mobile ?? '').trim()
    if (mobileRaw && !/^\d{10}$/.test(mobileRaw)) {
      return NextResponse.json({ error: 'Mobile must be 10 digits' }, { status: 400 })
    }
    const mobile = mobileRaw || null

    // Enforce role assignment hierarchy
    if (!canManageTargetRole(callerRole, role)) {
      return NextResponse.json(
        {
          error:
            'Forbidden: You do not have permission to assign this role. Only Finance administrators can grant Finance permissions.',
        },
        { status: 403 },
      )
    }

    try {
      const user = await prisma.user.create({
        data: {
          name,
          email,
          mobile,
        },
        select: {
          id: true,
          email: true,
          name: true,
          mobile: true,
          createdAt: true,
        },
      })

      if (role === 'ADMIN' || role === 'FINANCE') {
        await assignDynamicRole(email, role, session.user.email)
      }

      let passwordSet = false
      if (parsed.data.password && parsed.data.password.trim().length >= 6) {
        try {
          await setUserPassword(email, parsed.data.password.trim())
          passwordSet = true
        } catch (err: unknown) {
          console.error('[POST /api/admin/users] password creation failed:', err)
          const msg = err instanceof Error ? err.message : String(err)
          return NextResponse.json(
            {
              ...user,
              role,
              passwordWarning: `User created, but password could not be set automatically: ${msg}`,
            },
            { status: 201 },
          )
        }
      }

      return NextResponse.json(
        {
          ...user,
          role,
          passwordSet,
        },
        { status: 201 },
      )
    } catch (createErr) {
      if (createErr instanceof Prisma.PrismaClientKnownRequestError && createErr.code === 'P2002') {
        const existing = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, mobile: true },
        })
        if (existing) {
          // If role was specified and caller is allowed, assign dynamic role
          if (role === 'ADMIN' || role === 'FINANCE') {
            await assignDynamicRole(email, role, session.user.email)
          } else {
            await revokeDynamicRole(email)
          }

          let pwdSet = false
          if (parsed.data.password && parsed.data.password.trim().length >= 6) {
            try {
              await setUserPassword(email, parsed.data.password.trim())
              pwdSet = true
            } catch (pErr) {
              console.warn('[POST /api/admin/users] P2002 password update warning:', pErr)
            }
          }

          return NextResponse.json(
            {
              ...existing,
              role,
              passwordSet: pwdSet,
              message: `Updated user's role to ${role}`,
            },
            { status: 200 },
          )
        }
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
      throw createErr
    }
  } catch (err: unknown) {
    console.error('[POST /api/admin/users] Error:', err)
    const msg = err instanceof Error ? err.message : 'Internal server error while creating user'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
