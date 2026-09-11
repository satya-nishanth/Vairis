import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit, txObjectLabel } from '@/lib/finance-audit'
import { dateInputToIstDate } from '@/lib/finance'
import { prepareAllocations } from '@/lib/finance-allocations'
import {
  financeTransactionInclude,
  serializeFinanceTransaction,
} from '@/lib/finance-transaction-serialize'

export const dynamic = 'force-dynamic'

const allocationSchema = z.object({
  amount: z.number().positive('Allocation amount must be greater than 0'),
  orderId: z.string().min(1).optional().nullable(),
  purchaseBillId: z.string().min(1).optional().nullable(),
})

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  direction: z.enum(['INFLOW', 'OUTFLOW', 'TRANSFER']).optional(),
  amount: z.number().positive().optional(),
  gstAmount: z.number().min(0).optional(),
  description: z.string().trim().optional(),
  accountId: z.string().min(1).optional(),
  paidThroughAccountId: z.string().min(1).optional(),
  transferToAccountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  contactName: z.string().trim().optional(),
  orderIds: z.array(z.string()).optional(),
  unlinkedOrderLabels: z.array(z.string().trim().min(1)).optional(),
  inventoryItemIds: z.array(z.string()).optional(),
  unlinkedInventoryLabels: z.array(z.string().trim().min(1)).optional(),
  allocations: z.array(allocationSchema).optional(),
  reviewComplete: z.boolean().optional(),
})

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
  const existing = await prisma.financeTransaction.findUnique({
    where: { id },
    include: financeTransactionInclude,
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data
  const actor = financeActorFromSession(gate.session)
  const before = serializeFinanceTransaction(existing)

  const keys = Object.keys(d)
  if (keys.length === 1 && typeof d.reviewComplete === 'boolean') {
    const row = await prisma.financeTransaction.update({
      where: { id },
      data: { reviewComplete: d.reviewComplete },
      include: financeTransactionInclude,
    })
    const after = serializeFinanceTransaction(row)
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
  const nextAmount = d.amount ?? Number(existing.amount)

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
  }

  const resolved = isTransfer
    ? { contactId: null, contactName: '' }
    : await resolveContact(d.contactId, d.contactName)
  if (resolved && 'error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 })
  }

  let prepared:
    | { rows: { amount: number; orderId: string | null; purchaseBillId: string | null }[]; orderIds: string[] }
    | null = null
  if (isTransfer) {
    prepared = { rows: [], orderIds: [] }
  } else if (d.allocations !== undefined) {
    const p = await prepareAllocations(d.allocations, nextAmount)
    if ('error' in p) return NextResponse.json({ error: p.error }, { status: 400 })
    prepared = p
  }

  const orderIds = isTransfer
    ? []
    : d.orderIds !== undefined || prepared
      ? [...new Set([...(d.orderIds ?? []), ...(prepared?.orderIds ?? [])])]
      : undefined
  const unlinkedOrderLabels =
    isTransfer
      ? []
      : d.unlinkedOrderLabels !== undefined
        ? [...new Set(d.unlinkedOrderLabels.map((s) => s.trim()).filter(Boolean))]
        : undefined
  const inventoryItemIds =
    isTransfer ? [] : d.inventoryItemIds !== undefined ? [...new Set(d.inventoryItemIds)] : undefined
  const unlinkedInventoryLabels =
    isTransfer
      ? []
      : d.unlinkedInventoryLabels !== undefined
        ? [...new Set(d.unlinkedInventoryLabels.map((s) => s.trim()).filter(Boolean))]
        : undefined

  const nextOrderIds = orderIds ?? existing.orders.map((o) => o.orderId)
  const nextUnlinkedOrders = unlinkedOrderLabels ?? existing.unlinkedOrderLabels ?? []
  const nextInvIds = inventoryItemIds ?? existing.inventoryItems.map((l) => l.inventoryItemId)
  const nextUnlinkedInv = unlinkedInventoryLabels ?? existing.unlinkedInventoryLabels ?? []
  if (
    !isTransfer &&
    (nextOrderIds.length > 0 || nextUnlinkedOrders.length > 0) &&
    (nextInvIds.length > 0 || nextUnlinkedInv.length > 0)
  ) {
    return NextResponse.json(
      { error: 'Link to either orders or inventory, not both' },
      { status: 400 },
    )
  }

  if (orderIds?.length) {
    const found = await prisma.order.count({ where: { id: { in: orderIds } } })
    if (found !== orderIds.length) {
      return NextResponse.json({ error: 'One or more orders not found' }, { status: 400 })
    }
  }
  if (inventoryItemIds?.length) {
    const found = await prisma.inventoryItem.count({ where: { id: { in: inventoryItemIds } } })
    if (found !== inventoryItemIds.length) {
      return NextResponse.json({ error: 'One or more inventory items not found' }, { status: 400 })
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    if (orderIds !== undefined || isTransfer) {
      await tx.financeTransactionOrder.deleteMany({ where: { transactionId: id } })
      if (orderIds?.length) {
        await tx.financeTransactionOrder.createMany({
          data: orderIds.map((orderId) => ({ transactionId: id, orderId })),
        })
      }
    }
    if (inventoryItemIds !== undefined || isTransfer) {
      await tx.financeTransactionInventory.deleteMany({ where: { transactionId: id } })
      if (inventoryItemIds?.length) {
        await tx.financeTransactionInventory.createMany({
          data: inventoryItemIds.map((inventoryItemId) => ({ transactionId: id, inventoryItemId })),
        })
      }
    }
    if (prepared) {
      await tx.financeAllocation.deleteMany({ where: { transactionId: id } })
      if (prepared.rows.length) {
        await tx.financeAllocation.createMany({
          data: prepared.rows.map((r) => ({
            transactionId: id,
            amount: r.amount,
            orderId: r.orderId,
            purchaseBillId: r.purchaseBillId,
          })),
        })
      }
    }
    return tx.financeTransaction.update({
      where: { id },
      data: {
        ...(d.date !== undefined ? { date: dateInputToIstDate(d.date) } : {}),
        ...(d.direction !== undefined ? { direction: d.direction } : {}),
        ...(d.amount !== undefined ? { amount: d.amount } : {}),
        ...(d.gstAmount !== undefined
          ? { gstAmount: isTransfer ? 0 : d.gstAmount }
          : isTransfer
            ? { gstAmount: 0 }
            : {}),
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
        ...(unlinkedOrderLabels !== undefined ? { unlinkedOrderLabels } : {}),
        ...(unlinkedInventoryLabels !== undefined ? { unlinkedInventoryLabels } : {}),
        ...(isTransfer ? { unlinkedOrderLabels: [], unlinkedInventoryLabels: [] } : {}),
      },
      include: financeTransactionInclude,
    })
  })

  const after = serializeFinanceTransaction(row)
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
  const existing = await prisma.financeTransaction.findUnique({
    where: { id },
    include: financeTransactionInclude,
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const before = serializeFinanceTransaction(existing)
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
