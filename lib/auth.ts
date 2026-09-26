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

import { NextResponse } from 'next/server'
import { isCachedAdminEmail, getEffectiveRole, type UserRole } from './roles'

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

/** Case-insensitive check against dynamic roles & ADMIN_EMAILS / FINANCE_EMAILS. */
export async function isAdminEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  const lower = email.trim().toLowerCase()
  const role = await getEffectiveRole(lower)
  return role === 'ADMIN' || role === 'FINANCE'
}

/** For Server Components / pages — redirects to login when unauthenticated. */
export async function requireAdmin() {
  const session = await getSession()
  if (!session) redirect('/auth/admin')
  const email = session.user.email?.toLowerCase()
  if (!email) redirect('/')
  const role = await getEffectiveRole(email)
  if (role !== 'ADMIN' && role !== 'FINANCE') redirect('/')
  return session
}

/**
 * API-safe admin authentication — returns { session, role, email } or { error: NextResponse }.
 * NEVER redirects, guaranteeing API callers always receive standard JSON 401/403 responses.
 */
export async function requireAdminApi(): Promise<
  | { session: NonNullable<Awaited<ReturnType<typeof getSession>>>; role: UserRole; email: string; error?: never }
  | { session?: never; role?: never; email?: never; error: NextResponse }
> {
  const session = await getSession()
  if (!session) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized: Session missing or expired. Please sign in.' },
        { status: 401 },
      ),
    }
  }
  const email = session.user?.email?.toLowerCase()
  if (!email) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized: Session missing email address.' },
        { status: 401 },
      ),
    }
  }
  const role = await getEffectiveRole(email)
  if (role !== 'ADMIN' && role !== 'FINANCE') {
    return {
      error: NextResponse.json(
        { error: 'Forbidden: Admin or Finance privilege required.' },
        { status: 403 },
      ),
    }
  }
  return { session, role, email }
}
