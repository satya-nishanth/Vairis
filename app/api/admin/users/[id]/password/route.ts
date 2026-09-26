import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveRole, canManageTargetRole } from '@/lib/roles'
import { setUserPassword, sendPasswordResetLink } from '@/lib/admin-user-service'

export const dynamic = 'force-dynamic'

const passwordActionSchema = z.object({
  action: z.enum(['set', 'reset']),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100).optional(),
})

/**
 * POST /api/admin/users/[id]/password
 * - action="set": directly set a new password for the user in Supabase Auth.
 * - action="reset": trigger password reset email and generate recovery link.
 *
 * Permission rule:
 * - Finance users can set/reset passwords for any user (USER, ADMIN, FINANCE).
 * - Admin users can set/reset passwords for USER and ADMIN users only.
 *   They CANNOT set/reset passwords for FINANCE users.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdminApi()
    if (authResult.error) return authResult.error
    const { role: callerRole } = authResult

    const { id } = await params

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const targetRole = await getEffectiveRole(targetUser.email)

    // Enforce role boundary
    if (!canManageTargetRole(callerRole, targetRole)) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Admins cannot manage passwords for Finance users. Only Finance administrators can perform this action.',
        },
        { status: 403 },
      )
    }

    const parsed = passwordActionSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      )
    }

    const { action, password } = parsed.data

    if (action === 'set') {
      if (!password || password.trim().length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters' },
          { status: 400 },
        )
      }

      await setUserPassword(targetUser.email, password.trim())

      return NextResponse.json({
        success: true,
        message: `Password successfully updated for ${targetUser.email}.`,
      })
    } else {
      // action === 'reset'
      const result = await sendPasswordResetLink(targetUser.email)

      return NextResponse.json({
        success: true,
        message: result.message,
        recoveryLink: result.recoveryLink,
      })
    }
  } catch (err: unknown) {
    console.error('[POST /api/admin/users/[id]/password] error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to execute password action'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
