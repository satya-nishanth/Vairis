import { createServerSupabaseClient } from './supabase-server'
import { prisma } from './prisma'
import { redirect } from 'next/navigation'

export async function getSession() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
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
  if (!session) redirect('/auth/login')
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())
  if (!adminEmails.includes(session.user.email!)) redirect('/')
  return session
}
