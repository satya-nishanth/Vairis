import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit, txObjectLabel } from '@/lib/finance-audit'
import { dateInputToIstDate } from '@/lib/finance'
import { allocationCreateNested, prepareAllocations } from '@/lib/finance-allocations'
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

const schema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date is required'),
    direction: z.enum(['INFLOW', 'OUTFLOW', 'TRANSFER']),
    amount: z.number().positive('Amount must be greater than 0'),
    gstAmount: z.number().min(0, 'GST cannot be negative').optional().default(0),
    description: z.string().trim().optional().default(''),
    accountId: z.string().min(1, 'Account is required'),
    paidThroughAccountId: z.string().min(1, 'Bank account is required'),
    transferToAccountId: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
    contactId: z.string().optional().nullable(),
    contactName: z.string().trim().optional().default(''),
    orderIds: z.array(z.string()).optional().default([]),
    unlinkedOrderLabels: z.array(z.string().trim().min(1)).optional().default([]),
    inventoryItemIds: z.array(z.string()).optional().default([]),
    unlinkedInventoryLabels: z.array(z.string().trim().min(1)).optional().default([]),
    allocations: z.array(allocationSchema).optional().default([]),
  })
  .superRefine((d, ctx) => {
    if (d.direction === 'TRANSFER') {
      if (!d.transferToAccountId) {
        ctx.addIssue({ code: 'custom', message: 'To account is required for a transfer', path: ['transferToAccountId'] })
      } else if (d.transferToAccountId === d.paidThroughAccountId) {
        ctx.addIssue({
          code: 'custom',
          message: 'From and To accounts must be different',
          path: ['transferToAccountId'],
        })
      }
    }
  })

async function resolveContact(contactId: string | null | undefined, contactName: string) {
  const name = contactName.trim()
  if (contactId) {
    const contact = await prisma.financeContact.findFirst({ where: { id: contactId, active: true } })
    if (!contact) return { error: 'Contact not found' as const }
    return { contactId: contact.id, contactName: contact.name }
  }
  return { contactId: null, contactName: name }
}

export async function GET() {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const rows = await prisma.financeTransaction.findMany({
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: financeTransactionInclude,
  })
  return NextResponse.json(rows.map(serializeFinanceTransaction))
}

export async function POST(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data
  const isTransfer = d.direction === 'TRANSFER'

  const account = await prisma.financeAccount.findFirst({ where: { id: d.accountId, active: true } })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 400 })

  const paidThrough = await prisma.financeAccount.findFirst({
    where: { id: d.paidThroughAccountId, active: true },
  })
  if (!paidThrough) {
    return NextResponse.json(
      { error: isTransfer ? 'From account not found' : 'Bank account not found' },
      { status: 400 },
    )
  }

  let transferToAccountId: string | null = null
  if (isTransfer) {
    const to = await prisma.financeAccount.findFirst({
      where: { id: d.transferToAccountId!, active: true },
    })
    if (!to) return NextResponse.json({ error: 'To account not found' }, { status: 400 })
    transferToAccountId = to.id
  }

  let categoryId: string | null = isTransfer ? null : d.categoryId || null
  if (categoryId) {
    const category = await prisma.financeCategory.findFirst({ where: { id: categoryId, active: true } })
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 400 })
    if (category.direction !== d.direction) {
      return NextResponse.json(
        { error: `Category is for ${category.direction === 'INFLOW' ? 'inflow' : 'outflow'} only` },
        { status: 400 },
      )
    }
  }

  const resolved = isTransfer
    ? { contactId: null, contactName: '' }
    : await resolveContact(d.contactId, d.contactName ?? '')
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 })

  const allocations = isTransfer ? [] : d.allocations
  const prepared = await prepareAllocations(allocations, d.amount)
  if ('error' in prepared) return NextResponse.json({ error: prepared.error }, { status: 400 })

  const orderIds = isTransfer
    ? []
    : [...new Set([...d.orderIds, ...prepared.orderIds])]
  const unlinkedOrderLabels = isTransfer
    ? []
    : [...new Set(d.unlinkedOrderLabels.map((s) => s.trim()).filter(Boolean))]
  const inventoryItemIds = isTransfer ? [] : [...new Set(d.inventoryItemIds)]
  const unlinkedInventoryLabels = isTransfer
    ? []
    : [...new Set(d.unlinkedInventoryLabels.map((s) => s.trim()).filter(Boolean))]

  const hasOrderLinks = orderIds.length > 0 || unlinkedOrderLabels.length > 0
  const hasInventoryLinks = inventoryItemIds.length > 0 || unlinkedInventoryLabels.length > 0
  if (hasOrderLinks && hasInventoryLinks) {
    return NextResponse.json(
      { error: 'Link to either orders or inventory, not both' },
      { status: 400 },
    )
  }

  if (orderIds.length) {
    const found = await prisma.order.count({ where: { id: { in: orderIds } } })
    if (found !== orderIds.length) {
      return NextResponse.json({ error: 'One or more orders not found' }, { status: 400 })
    }
  }
  if (inventoryItemIds.length) {
    const found = await prisma.inventoryItem.count({ where: { id: { in: inventoryItemIds } } })
    if (found !== inventoryItemIds.length) {
      return NextResponse.json({ error: 'One or more inventory items not found' }, { status: 400 })
    }
  }

  try {
    const row = await prisma.financeTransaction.create({
      data: {
        date: dateInputToIstDate(d.date),
        direction: d.direction,
        amount: d.amount,
        gstAmount: d.direction === 'TRANSFER' ? 0 : d.gstAmount,
        description: d.description ?? '',
        accountId: d.accountId,
        paidThroughAccountId: d.paidThroughAccountId,
        transferToAccountId,
        categoryId,
        contactId: resolved.contactId,
        contactName: resolved.contactName,
        autoCreated: false,
        reviewComplete: true,
        unlinkedOrderLabels,
        unlinkedInventoryLabels,
        orders: orderIds.length ? { create: orderIds.map((orderId) => ({ orderId })) } : undefined,
        inventoryItems: inventoryItemIds.length
          ? { create: inventoryItemIds.map((inventoryItemId) => ({ inventoryItemId })) }
          : undefined,
        allocations: prepared.rows.length
          ? { create: allocationCreateNested(prepared.rows) }
          : undefined,
      },
      include: financeTransactionInclude,
    })
    const after = serializeFinanceTransaction(row)
    await logFinanceAudit({
      actor: financeActorFromSession(gate.session),
      action: 'CREATE',
      entityType: 'TRANSACTION',
      entityId: row.id,
      objectLabel: txObjectLabel(after),
      objectHref: `/admin/finance/transactions?edit=${row.id}`,
      summary: `Created ${d.direction.toLowerCase()} ₹${after.amount.toLocaleString('en-IN')}${after.contactName ? ` — ${after.contactName}` : ''}`,
      after,
    })
    return NextResponse.json(after, { status: 201 })
  } catch (err) {
    console.error('[finance.transactions.POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 },
    )
  }
}
