import { notFound } from 'next/navigation'
import { getSession, requireAdmin } from './auth'
import { NextResponse } from 'next/server'
import { prisma } from './prisma'
import { getEffectiveRole, isCachedFinanceEmail, getEnvFinanceEmails } from './roles'

export function financeEmails(): string[] {
  return getEnvFinanceEmails()
}

export function isFinanceEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const lower = email.trim().toLowerCase()
  if (financeEmails().includes(lower)) return true
  return isCachedFinanceEmail(lower)
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
  const role = await getEffectiveRole(session.user.email)
  if (role !== 'FINANCE') notFound()
  return session
}

export async function requireFinanceApi() {
  const session = await getSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const email = session.user.email?.toLowerCase() ?? ''
  const role = await getEffectiveRole(email)
  if (role !== 'FINANCE') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session }
}

