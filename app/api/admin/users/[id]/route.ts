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
  assignDynamicRole,
  revokeDynamicRole,
  type UserRole,
} from '@/lib/roles'
import { setUserPassword, sendPasswordResetLink } from '@/lib/admin-user-service'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
  mobile: z.string().trim().max(10).optional().nullable(),
  role: z.enum(['USER', 'ADMIN', 'FINANCE']).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100).optional().nullable(),
  resetPassword: z.boolean().optional(),
})

/**
 * PATCH /api/admin/users/[id] — update customer / user profile, role, and password.
 * Respects delegation hierarchy:
 * - Finance users can modify any user and change role to USER, ADMIN, or FINANCE.
 * - Admin users can only modify USER and ADMIN users, and cannot grant or revoke FINANCE.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdminApi()
    if (authResult.error) return authResult.error
    const { session, role: callerRole } = authResult

    const { id } = await params
    const rawBody = await req.json().catch(() => ({}))
    const parsed = patchSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      )
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const currentRole = await getEffectiveRole(existing.email)

    // 1. Boundary check: Can the caller manage the target user's current role?
    if (!canManageTargetRole(callerRole, currentRole)) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Admins cannot modify Finance users. Only Finance administrators can manage Finance accounts.',
        },
        { status: 403 },
      )
    }

    // 2. Boundary check: Can the caller assign the requested role?
    if (parsed.data.role && parsed.data.role !== currentRole) {
      if (!canManageTargetRole(callerRole, parsed.data.role)) {
        return NextResponse.json(
          {
            error:
              'Forbidden: Admins cannot assign the Finance role. Only Finance administrators can grant Finance permissions.',
          },
          { status: 403 },
        )
      }
    }

    const email = parsed.data.email ? parsed.data.email.toLowerCase() : existing.email
    let mobile: string | null | undefined = undefined
    if (parsed.data.mobile !== undefined) {
      const mobileRaw = (parsed.data.mobile ?? '').toString().trim()
      if (mobileRaw && !/^\d{10}$/.test(mobileRaw)) {
        return NextResponse.json({ error: 'Mobile must be 10 digits' }, { status: 400 })
      }
      mobile = mobileRaw || null
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.email ? { email } : {}),
        ...(mobile !== undefined ? { mobile } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        mobile: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    })

    // Sync dynamic role assignment
    let finalRole: UserRole = currentRole
    if (parsed.data.role) {
      finalRole = parsed.data.role
      if (parsed.data.role === 'ADMIN' || parsed.data.role === 'FINANCE') {
        await assignDynamicRole(email, parsed.data.role, session.user.email)
      } else {
        await revokeDynamicRole(email)
      }
    }

    let passwordSet = false
    let resetResult: { recoveryLink?: string; message: string } | null = null

    if (parsed.data.password && parsed.data.password.trim().length >= 6) {
      try {
        await setUserPassword(email, parsed.data.password.trim())
        passwordSet = true
      } catch (pwdErr) {
        console.warn('[PATCH /api/admin/users/[id]] password set warning:', pwdErr)
      }
    }

    if (parsed.data.resetPassword) {
      try {
        resetResult = await sendPasswordResetLink(email)
      } catch (rstErr) {
        console.warn('[PATCH /api/admin/users/[id]] reset password warning:', rstErr)
      }
    }

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      mobile: updated.mobile,
      role: finalRole,
      createdAt: updated.createdAt.toISOString(),
      orderCount: updated._count.orders,
      passwordSet,
      recoveryLink: resetResult?.recoveryLink,
      message: resetResult?.message,
    })
  } catch (err: unknown) {
    console.error('[admin.users.PATCH] Error updating user:', err)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }
    const message = err instanceof Error ? err.message : 'Internal server error while updating user'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/users/[id] — remove user (only if no existing orders).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdminApi()
    if (authResult.error) return authResult.error
    const { role: callerRole } = authResult

    const { id } = await params

    const target = await prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const targetRole = await getEffectiveRole(target.email)

    if (!canManageTargetRole(callerRole, targetRole)) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Admins cannot delete Finance users. Only Finance administrators have this privilege.',
        },
        { status: 403 },
      )
    }


    if (target._count.orders > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete user with ${target._count.orders} order(s). You can change their role to USER instead.`,
        },
        { status: 400 },
      )
    }

    await revokeDynamicRole(target.email)

    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'User deleted successfully.' })
  } catch (err: unknown) {
    console.error('[admin.users.DELETE] Error deleting user:', err)
    const message = err instanceof Error ? err.message : 'Internal server error while deleting user'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
