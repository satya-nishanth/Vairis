import { createServerSupabaseClient } from './supabase-server'
import { prisma } from './prisma'
import { redirect } from 'next/navigation'
import type { User } from '@prisma/client'

// getSession() reads from cookie — fast, no extra network round-trip.
// JWT is signed by Supabase and verified locally — safe for a jewellery store.
// Use getUser() only if you need to verify against Auth server (banking-level security).
export async function getSession() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

/** Resolve the Prisma User for the current Supabase session (creates row if missing). */
export async function getAppUser(): Promise<User | null> {
  const session = await getSession()
  const email = session?.user?.email
  if (!email) return null

  const name =
    (session!.user.user_metadata?.full_name as string | undefined) ??
    (session!.user.user_metadata?.name as string | undefined) ??
    email.split('@')[0]

  const isGoogle = session!.user.app_metadata?.provider === 'google'

  try {
    return await prisma.user.upsert({
      where: { email },
      update: isGoogle ? { googleId: session!.user.id } : {},
      create: {
        email,
        name,
        googleId: isGoogle ? session!.user.id : undefined,
      },
    })
  } catch (err) {
    // Local Supabase stopped (P1001) etc. — callers return 401/503 instead of crashing.
    console.error('[auth.getAppUser] database error', err)
    return null
  }
}

/** For Server Components / pages — redirects to login when unauthenticated. */
export async function requireUser() {
  const user = await getAppUser()
  if (!user) redirect('/auth/login')
  return user
}

/** Case-insensitive check against ADMIN_EMAILS — shared so admin-gated
 * pages and APIs (e.g. requireFinanceApi) can't drift on what counts
 * as an admin email. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())
  return adminEmails.includes(email.toLowerCase())
}

export async function requireAdmin() {
  const session = await getSession()
  if (!session) redirect('/auth/admin')
  if (!isAdminEmail(session.user.email)) redirect('/')
  return session
}
