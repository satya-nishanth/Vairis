import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit, txObjectLabel } from '@/lib/finance-audit'
import { dateInputToIstDate } from '@/lib/finance'

export const dynamic = 'force-dynamic'

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  direction: z.enum(['INFLOW', 'OUTFLOW', 'TRANSFER']).optional(),
  amount: z.number().positive().optional(),
  description: z.string().trim().optional(),
  accountId: z.string().min(1).optional(),
  paidThroughAccountId: z.string().min(1).optional(),
  transferToAccountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  contactName: z.string().trim().optional(),
  orderIds: z.array(z.string()).optional(),
  /** Mark auto-created inflow as reviewed (admin ack). */
  reviewComplete: z.boolean().optional(),
})

function serialize(row: {
  id: string
  date: Date
  direction: string
  amount: { toString(): string } | number
  description: string
  accountId: string
  paidThroughAccountId: string
  transferToAccountId: string | null
  categoryId: string | null
  contactId: string | null
  contactName: string
  autoCreated: boolean
  reviewComplete: boolean
  createdAt: Date
  updatedAt: Date
  account?: { id: string; name: string }
  paidThroughAccount?: { id: string; name: string }
  transferToAccount?: { id: string; name: string } | null
  category?: { id: string; name: string } | null
  contact?: { id: string; name: string } | null
  orders?: { orderId: string; order: { id: string; contactName: string } }[]
}) {
  return {
    id: row.id,
    date: row.date.toISOString(),
    direction: row.direction,
    amount: Number(row.amount),
    description: row.description,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    paidThroughAccountId: row.paidThroughAccountId,
    paidThroughAccountName: row.paidThroughAccount?.name ?? null,
    transferToAccountId: row.transferToAccountId,
    transferToAccountName: row.transferToAccount?.name ?? null,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    contactId: row.contactId,
    contactName: row.contactName || row.contact?.name || null,
    autoCreated: row.autoCreated,
    reviewComplete: row.reviewComplete,
    orderIds: row.orders?.map((o) => o.orderId) ?? [],
    orders:
      row.orders?.map((o) => ({
        id: o.order.id,
        contactName: o.order.contactName,
      })) ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const include = {
  account: { select: { id: true, name: true } },
  paidThroughAccount: { select: { id: true, name: true } },
  transferToAccount: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  contact: { select: { id: true, name: true } },
  orders: { include: { order: { select: { id: true, contactName: true } } } },
} as const

async function resolveContact(contactId: string | null | undefined, contactName: string | undefined) {
  if (contactId === undefined && contactName === undefined) return null
  const name = (contactName ?? '').trim()
  if (contactId) {
    const contact = await prisma.financeContact.findFirst({ where: { id: contactId, active: true } })
    if (!contact) return { error: 'Contact not found' as const }
    return { contactId: contact.id, contactName: contact.name }
  }
  return { contactId: null, contactName: name }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const { id } = await params
  const existing = await prisma.financeTransaction.findUnique({ where: { id }, include })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data
  const actor = financeActorFromSession(gate.session)
  const before = serialize(existing)

  // Review-status-only patch (inline table control).
  const keys = Object.keys(d)
  if (keys.length === 1 && typeof d.reviewComplete === 'boolean') {
    const row = await prisma.financeTransaction.update({
      where: { id },
      data: { reviewComplete: d.reviewComplete },
      include,
    })
    const after = serialize(row)
    await logFinanceAudit({
      actor,
      action: 'UPDATE',
      entityType: 'TRANSACTION',
      entityId: row.id,
      objectLabel: txObjectLabel(before),
      objectHref: `/admin/finance/transactions?edit=${row.id}`,
      summary: `Review status → ${d.reviewComplete ? 'Reviewed' : 'For review'}`,
      before: { id: before.id, reviewComplete: before.reviewComplete },
      after: { id: after.id, reviewComplete: after.reviewComplete },
    })
    return NextResponse.json(after)
  }

  const nextDirection = d.direction ?? existing.direction
  const isTransfer = nextDirection === 'TRANSFER'
  const nextFrom = d.paidThroughAccountId ?? existing.paidThroughAccountId
  const nextTo =
    d.transferToAccountId !== undefined ? d.transferToAccountId : existing.transferToAccountId

  if (isTransfer) {
    if (!nextTo) {
      return NextResponse.json({ error: 'To account is required for a transfer' }, { status: 400 })
    }
    if (nextTo === nextFrom) {
      return NextResponse.json({ error: 'From and To accounts must be different' }, { status: 400 })
    }
  }

  if (d.accountId) {
    const account = await prisma.financeAccount.findFirst({ where: { id: d.accountId, active: true } })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 400 })
  }
  if (d.paidThroughAccountId) {
    const paidThrough = await prisma.financeAccount.findFirst({
      where: { id: d.paidThroughAccountId, active: true },
    })
    if (!paidThrough) {
      return NextResponse.json(
        { error: isTransfer ? 'From account not found' : 'Bank account not found' },
        { status: 400 },
      )
    }
  }
  if (isTransfer && nextTo) {
    const to = await prisma.financeAccount.findFirst({ where: { id: nextTo, active: true } })
    if (!to) return NextResponse.json({ error: 'To account not found' }, { status: 400 })
  }

  if (!isTransfer && d.categoryId) {
    const category = await prisma.financeCategory.findFirst({ where: { id: d.categoryId, active: true } })
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 400 })
    if (category.direction !== nextDirection) {
      return NextResponse.json(
        { error: `Category is for ${category.direction === 'INFLOW' ? 'inflow' : 'outflow'} only` },
        { status: 400 },
      )
    }
  } else if (d.direction === 'TRANSFER' || (d.direction && existing.categoryId && d.direction !== existing.direction)) {
    // switching away from matching category — clear if mismatch handled below
  }

  const resolved = isTransfer
    ? { contactId: null, contactName: '' }
    : await resolveContact(d.contactId, d.contactName)
  if (resolved && 'error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 })
  }

  const orderIds = isTransfer ? [] : d.orderIds ? [...new Set(d.orderIds)] : undefined
  if (orderIds?.length) {
    const found = await prisma.order.count({ where: { id: { in: orderIds } } })
    if (found !== orderIds.length) {
      return NextResponse.json({ error: 'One or more orders not found' }, { status: 400 })
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    if (orderIds || isTransfer) {
      await tx.financeTransactionOrder.deleteMany({ where: { transactionId: id } })
      if (orderIds?.length) {
        await tx.financeTransactionOrder.createMany({
          data: orderIds.map((orderId) => ({ transactionId: id, orderId })),
        })
      }
    }
    return tx.financeTransaction.update({
      where: { id },
      data: {
        ...(d.date !== undefined ? { date: dateInputToIstDate(d.date) } : {}),
        ...(d.direction !== undefined ? { direction: d.direction } : {}),
        ...(d.amount !== undefined ? { amount: d.amount } : {}),
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.accountId !== undefined ? { accountId: d.accountId } : {}),
        ...(d.paidThroughAccountId !== undefined
          ? { paidThroughAccountId: d.paidThroughAccountId }
          : {}),
        transferToAccountId: isTransfer ? nextTo : null,
        categoryId: isTransfer ? null : d.categoryId !== undefined ? d.categoryId || null : undefined,
        ...(resolved
          ? { contactId: resolved.contactId, contactName: resolved.contactName }
          : {}),
        ...(typeof d.reviewComplete === 'boolean' ? { reviewComplete: d.reviewComplete } : {}),
      },
      include,
    })
  })

  const after = serialize(row)
  await logFinanceAudit({
    actor,
    action: 'UPDATE',
    entityType: 'TRANSACTION',
    entityId: row.id,
    objectLabel: txObjectLabel(after),
    objectHref: `/admin/finance/transactions?edit=${row.id}`,
    summary: `Updated ${after.direction.toLowerCase()} ₹${after.amount.toLocaleString('en-IN')}`,
    before,
    after,
  })
  return NextResponse.json(after)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const { id } = await params
  const existing = await prisma.financeTransaction.findUnique({ where: { id }, include })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const before = serialize(existing)
  await prisma.financeTransaction.delete({ where: { id } })
  await logFinanceAudit({
    actor: financeActorFromSession(gate.session),
    action: 'DELETE',
    entityType: 'TRANSACTION',
    entityId: id,
    objectLabel: txObjectLabel(before),
    objectHref: '/admin/finance/transactions',
    summary: `Deleted ${before.direction.toLowerCase()} ₹${before.amount.toLocaleString('en-IN')}`,
    before,
  })
  return NextResponse.json({ ok: true })
}
