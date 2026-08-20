import { notFound } from 'next/navigation'
import { getSession, requireAdmin } from './auth'
import { NextResponse } from 'next/server'
import type { FinancePerson } from '@prisma/client'

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

/** Map login email to Anil / Surya / Vasu for the default contributor. */
export function defaultFinancePerson(email: string): FinancePerson {
  const local = email.split('@')[0]?.toLowerCase() ?? ''
  if (local.includes('surya')) return 'SURYA'
  if (local.includes('vasu')) return 'VASU'
  return 'ANIL'
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
