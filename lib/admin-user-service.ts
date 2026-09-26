import { getSupabaseAdmin } from './supabase-admin'
import { prisma } from './prisma'

export interface SupabaseAuthUserSummary {
  id: string
  email: string
  confirmed: boolean
  lastSignInAt?: string | null
  createdAt: string
  providers: string[]
}

/**
 * Locate a user in Supabase Auth by email.
 * Traverses pages up to a reasonable cap (e.g. 10 pages of 100).
 */
export async function findSupabaseUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  const admin = getSupabaseAdmin()

  let page = 1
  const perPage = 100
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error || !data?.users) {
      if (error) console.error('[findSupabaseUserByEmail] listUsers error', error)
      break
    }

    const found = data.users.find((u) => u.email?.trim().toLowerCase() === normalized)
    if (found) return found

    if (data.users.length < perPage) break
    page++
  }

  return null
}

/**
 * Directly set or create password for an email address.
 * If user does not exist in Supabase auth, creates them with confirmed email.
 */
export async function setUserPassword(email: string, password: string): Promise<{ success: boolean; userId: string }> {
  const normalized = email.trim().toLowerCase()
  const admin = getSupabaseAdmin()

  const existing = await findSupabaseUserByEmail(normalized)

  if (existing) {
    const { error, data } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    })
    if (error) {
      throw new Error(`Failed to update password: ${error.message}`)
    }
    return { success: true, userId: data.user.id }
  } else {
    // Look up Prisma user for display name if available
    const dbUser = await prisma.user.findUnique({
      where: { email: normalized },
      select: { name: true },
    })

    const { error, data } = await admin.auth.admin.createUser({
      email: normalized,
      password,
      email_confirm: true,
      user_metadata: {
        name: dbUser?.name ?? normalized.split('@')[0],
      },
    })
    if (error) {
      throw new Error(`Failed to create auth user with password: ${error.message}`)
    }
    return { success: true, userId: data.user.id }
  }
}

/**
 * Generate password reset / recovery link and optionally send recovery email.
 */
export async function sendPasswordResetLink(email: string): Promise<{
  recoveryLink?: string
  message: string
}> {
  const normalized = email.trim().toLowerCase()
  const admin = getSupabaseAdmin()
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const redirectTo = `${baseUrl}/auth/update-password`

  // First generate the recovery action link
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: normalized,
    options: {
      redirectTo,
    },
  })

  // Also trigger official email if possible
  let emailSent = false
  try {
    const { error: resetErr } = await admin.auth.resetPasswordForEmail(normalized, {
      redirectTo,
    })
    if (!resetErr) emailSent = true
  } catch (err) {
    console.warn('[sendPasswordResetLink] resetPasswordForEmail warning:', err)
  }

  const recoveryLink = linkData?.properties?.action_link ?? undefined

  if (linkError && !emailSent) {
    throw new Error(`Password reset failed: ${linkError.message}`)
  }

  return {
    recoveryLink,
    message: emailSent
      ? 'Password reset email dispatched successfully.'
      : 'Password reset link generated.',
  }
}
