import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit } from '@/lib/finance-audit'
import { dateInputToIstDate } from '@/lib/finance'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date is required'),
  description: z.string().trim().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  paidThrough: z.enum(['VAIRIS_BANK', 'PERSONAL_FUNDS']),
  accountId: z.string().min(1).optional().nullable(),
}).superRefine((d, ctx) => {
  // Who is accountable: required when personal funds, optional when company bank
  // (but allowed when company bank — "I paid through company")
  if (d.paidThrough === 'PERSONAL_FUNDS' && !d.accountId) {
    ctx.addIssue({ code: 'custom', path: ['accountId'], message: 'Account is required for personal funds' })
  }
})

function serialize(row: {
  id: string
  date: Date
  description: string
  amount: { toString(): string } | number
  paidThrough: string
  accountId: string | null
  createdAt: Date
  updatedAt: Date
  account?: { id: string; name: string } | null
}) {
  return {
    id: row.id,
    date: row.date.toISOString(),
    description: row.description,
    amount: Number(row.amount),
    paidThrough: row.paidThrough,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function GET() {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const rows = await prisma.generalExpense.findMany({
    orderBy: { date: 'desc' },
    include: { account: { select: { id: true, name: true } } },
  })
  return NextResponse.json(rows.map(serialize))
}

export async function POST(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data
  if (d.accountId) {
    const account = await prisma.financeAccount.findFirst({ where: { id: d.accountId, active: true } })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 400 })
  }
  const row = await prisma.generalExpense.create({
    data: {
      date: dateInputToIstDate(d.date),
      description: d.description,
      amount: d.amount,
      paidThrough: d.paidThrough,
      accountId: d.accountId || null,
    },
    include: { account: { select: { id: true, name: true } } },
  })
  const after = serialize(row)
  await logFinanceAudit({
    actor: financeActorFromSession(gate.session),
    action: 'CREATE',
    entityType: 'EXPENSE',
    entityId: row.id,
    objectLabel: row.description.slice(0, 80) || `Expense ₹${after.amount.toLocaleString('en-IN')}`,
    objectHref: '/admin/finance/expenses',
    summary: `Created expense ₹${after.amount.toLocaleString('en-IN')} — ${row.description.slice(0, 80)}`,
    after,
  })
  return NextResponse.json(after, { status: 201 })
}
