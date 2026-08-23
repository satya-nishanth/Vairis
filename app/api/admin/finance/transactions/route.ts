import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit, txObjectLabel } from '@/lib/finance-audit'
import { dateInputToIstDate } from '@/lib/finance'

export const dynamic = 'force-dynamic'

const schema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date is required'),
    direction: z.enum(['INFLOW', 'OUTFLOW', 'TRANSFER']),
    amount: z.number().positive('Amount must be greater than 0'),
    description: z.string().trim().optional().default(''),
    accountId: z.string().min(1, 'Account is required'),
    paidThroughAccountId: z.string().min(1, 'Bank account is required'),
    transferToAccountId: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
    contactId: z.string().optional().nullable(),
    contactName: z.string().trim().optional().default(''),
    orderIds: z.array(z.string()).optional().default([]),
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
    include,
  })
  return NextResponse.json(rows.map(serialize))
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

  const orderIds = isTransfer ? [] : [...new Set(d.orderIds)]
  if (orderIds.length) {
    const found = await prisma.order.count({ where: { id: { in: orderIds } } })
    if (found !== orderIds.length) {
      return NextResponse.json({ error: 'One or more orders not found' }, { status: 400 })
    }
  }

  const row = await prisma.financeTransaction.create({
    data: {
      date: dateInputToIstDate(d.date),
      direction: d.direction,
      amount: d.amount,
      description: d.description ?? '',
      accountId: d.accountId,
      paidThroughAccountId: d.paidThroughAccountId,
      transferToAccountId,
      categoryId,
      contactId: resolved.contactId,
      contactName: resolved.contactName,
      autoCreated: false,
      reviewComplete: true,
      orders: orderIds.length ? { create: orderIds.map((orderId) => ({ orderId })) } : undefined,
    },
    include,
  })
  const after = serialize(row)
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
}
