import { createServerSupabaseClient } from './supabase-server'
import { prisma } from './prisma'
import { redirect } from 'next/navigation'

// Uses getUser() which verifies the JWT with Supabase Auth servers — safe for server-side use.
// getSession() only reads cookies without verification and should not be used for auth decisions.
export async function getSession() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return { user }
}

export async function requireUser() {
  const session = await getSession()
  if (!session) redirect('/auth/login')
  const user = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!user) redirect('/auth/login')
  return user
}

export async function requireAdmin() {
  const session = await getSession()
  if (!session) redirect('/auth/admin')
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())
  if (!adminEmails.includes(session.user.email!)) redirect('/')
  return session
}
