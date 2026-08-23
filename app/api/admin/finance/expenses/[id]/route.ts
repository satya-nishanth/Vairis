import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit } from '@/lib/finance-audit'
import { dateInputToIstDate, shortFinanceId } from '@/lib/finance'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().trim().min(1).optional(),
  amount: z.number().positive().optional(),
  paidThrough: z.enum(['VAIRIS_BANK', 'PERSONAL_FUNDS']).optional(),
  accountId: z.string().min(1).optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const existing = await prisma.generalExpense.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const nextThrough = parsed.data.paidThrough ?? existing.paidThrough
  let accountId =
    parsed.data.accountId === undefined ? existing.accountId : parsed.data.accountId
  if (nextThrough === 'PERSONAL_FUNDS' && !accountId) {
    return NextResponse.json({ error: 'Account is required for personal funds' }, { status: 400 })
  }
  if (accountId) {
    const account = await prisma.financeAccount.findFirst({ where: { id: accountId, active: true } })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 400 })
  }

  const row = await prisma.generalExpense.update({
    where: { id },
    data: {
      date: parsed.data.date ? dateInputToIstDate(parsed.data.date) : undefined,
      description: parsed.data.description,
      amount: parsed.data.amount,
      paidThrough: parsed.data.paidThrough,
      accountId,
    },
    include: { account: { select: { id: true, name: true } } },
  })
  const after = {
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
  await logFinanceAudit({
    actor: financeActorFromSession(gate.session),
    action: 'UPDATE',
    entityType: 'EXPENSE',
    entityId: row.id,
    objectLabel: row.description.slice(0, 80) || `Expense ₹${after.amount.toLocaleString('en-IN')}`,
    objectHref: '/admin/finance/expenses',
    summary: `Updated expense “${row.description.slice(0, 80)}”`,
    before: {
      id: existing.id,
      date: existing.date.toISOString(),
      description: existing.description,
      amount: Number(existing.amount),
      paidThrough: existing.paidThrough,
      accountId: existing.accountId,
    },
    after,
  })
  return NextResponse.json(after)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const { id } = await params
  const existing = await prisma.generalExpense.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.generalExpense.delete({ where: { id } })
  await logFinanceAudit({
    actor: financeActorFromSession(gate.session),
    action: 'DELETE',
    entityType: 'EXPENSE',
    entityId: id,
    objectLabel: existing.description.slice(0, 80) || shortFinanceId(id),
    objectHref: '/admin/finance/expenses',
    summary: `Deleted expense “${existing.description.slice(0, 80)}” (₹${Number(existing.amount).toLocaleString('en-IN')})`,
    before: {
      id: existing.id,
      date: existing.date.toISOString(),
      description: existing.description,
      amount: Number(existing.amount),
      paidThrough: existing.paidThrough,
      accountId: existing.accountId,
    },
  })
  return new NextResponse(null, { status: 204 })
}
