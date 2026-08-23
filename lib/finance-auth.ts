import { notFound } from 'next/navigation'
import { getSession, requireAdmin } from './auth'
import { NextResponse } from 'next/server'
import { prisma } from './prisma'

export function financeEmails(): string[] {
  return (process.env.FINANCE_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isFinanceEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return financeEmails().includes(email.toLowerCase())
}

/** Resolve Config Account for this login email (partner default). */
export async function defaultFinanceAccountId(email: string | null | undefined): Promise<string | null> {
  if (!email) return null
  const account = await prisma.financeAccount.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, active: true },
    select: { id: true },
  })
  return account?.id ?? null
}

export async function requireFinance() {
  const session = await requireAdmin()
  if (!isFinanceEmail(session.user.email)) notFound()
  return session
}

export async function requireFinanceApi() {
  const session = await getSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())
  const email = session.user.email?.toLowerCase() ?? ''
  if (!adminEmails.includes(email) || !isFinanceEmail(email)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session }
}
