import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit } from '@/lib/finance-audit'
import { dateInputToIstDate, roundMoney, shortFinanceId, toDateInput } from '@/lib/finance'
import {
  collectedByPurchaseBillIds,
  purchaseBillPaymentSummary,
} from '@/lib/finance-collections'

export const dynamic = 'force-dynamic'

const lineSchema = z.object({
  description: z.string().trim().optional().default(''),
  amount: z.number().positive('Line amount must be greater than 0'),
})

const attachmentSchema = z.object({
  url: z.string().url(),
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().optional().default(''),
})

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date is required'),
  billNumber: z.string().trim().optional().default(''),
  supplierContactId: z.string().optional().nullable(),
  supplierName: z.string().trim().optional().default(''),
  description: z.string().trim().optional().default(''),
  gstAmount: z.number().min(0).optional().default(0),
  totalAmount: z.number().positive('Total must be greater than 0'),
  notes: z.string().trim().optional().default(''),
  lines: z.array(lineSchema).optional().default([]),
  attachments: z.array(attachmentSchema).optional().default([]),
})

const include = {
  supplierContact: { select: { id: true, name: true } },
  lines: { orderBy: { sortOrder: 'asc' as const } },
  attachments: { orderBy: { createdAt: 'asc' as const } },
} as const

async function serializeBill(row: {
  id: string
  billNumber: string
  date: Date
  supplierContactId: string | null
  supplierName: string
  description: string
  gstAmount: { toString(): string } | number
  totalAmount: { toString(): string } | number
  notes: string
  createdAt: Date
  updatedAt: Date
  supplierContact?: { id: string; name: string } | null
  lines: { id: string; description: string; amount: { toString(): string } | number; sortOrder: number }[]
  attachments: {
    id: string
    url: string
    fileName: string
    contentType: string
    createdAt: Date
  }[]
}, paid = 0) {
  const total = Number(row.totalAmount)
  const summary = purchaseBillPaymentSummary(total, paid)
  return {
    id: row.id,
    billNumber: row.billNumber,
    date: row.date.toISOString(),
    dateInput: toDateInput(row.date),
    supplierContactId: row.supplierContactId,
    supplierName: row.supplierName || row.supplierContact?.name || '',
    description: row.description,
    gstAmount: Number(row.gstAmount),
    totalAmount: total,
    notes: row.notes,
    lines: row.lines.map((l) => ({
      id: l.id,
      description: l.description,
      amount: Number(l.amount),
      sortOrder: l.sortOrder,
    })),
    attachments: row.attachments.map((a) => ({
      id: a.id,
      url: a.url,
      fileName: a.fileName,
      contentType: a.contentType,
      createdAt: a.createdAt.toISOString(),
    })),
    paid: summary.paid,
    balance: summary.balance,
    paymentStatus: summary.paymentStatus,
    label: `Bill ${row.billNumber || shortFinanceId(row.id)}${
      row.supplierName || row.supplierContact?.name
        ? ` — ${row.supplierName || row.supplierContact?.name}`
        : ''
    }`,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function resolveSupplier(contactId: string | null | undefined, name: string) {
  const trimmed = name.trim()
  if (contactId) {
    const contact = await prisma.financeContact.findFirst({ where: { id: contactId, active: true } })
    if (!contact) return { error: 'Supplier contact not found' as const }
    return { supplierContactId: contact.id, supplierName: contact.name }
  }
  return { supplierContactId: null, supplierName: trimmed }
}

export async function GET(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const openOnly = req.nextUrl.searchParams.get('open') === '1'
  const excludeTransactionId = req.nextUrl.searchParams.get('excludeTxn')?.trim() || undefined

  const rows = await prisma.purchaseBill.findMany({
    where: q
      ? {
          OR: [
            { billNumber: { contains: q, mode: 'insensitive' } },
            { supplierName: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include,
    take: q ? 40 : 200,
  })
  const paidMap = await collectedByPurchaseBillIds(
    rows.map((r) => r.id),
    excludeTransactionId ? { excludeTransactionId } : undefined,
  )
  let out = await Promise.all(rows.map((r) => serializeBill(r, paidMap.get(r.id) ?? 0)))
  if (openOnly) {
    out = out.filter((b) => b.paymentStatus === 'unpaid' || b.paymentStatus === 'partial')
  }
  return NextResponse.json(out)
}

export async function POST(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data
  const resolved = await resolveSupplier(d.supplierContactId, d.supplierName ?? '')
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 })

  if (d.lines.length) {
    const lineSum = roundMoney(d.lines.reduce((s, l) => s + l.amount, 0))
    if (Math.abs(lineSum - roundMoney(d.totalAmount)) > 0.05) {
      // soft: allow overall ≠ lines; no error — UI can set overall independently
    }
  }

  try {
    const row = await prisma.purchaseBill.create({
      data: {
        date: dateInputToIstDate(d.date),
        billNumber: d.billNumber ?? '',
        supplierContactId: resolved.supplierContactId,
        supplierName: resolved.supplierName,
        description: d.description ?? '',
        gstAmount: d.gstAmount,
        totalAmount: d.totalAmount,
        notes: d.notes ?? '',
        lines: d.lines.length
          ? {
              create: d.lines.map((l, i) => ({
                description: l.description ?? '',
                amount: l.amount,
                sortOrder: i,
              })),
            }
          : undefined,
        attachments: d.attachments.length
          ? {
              create: d.attachments.map((a) => ({
                url: a.url,
                fileName: a.fileName,
                contentType: a.contentType ?? '',
              })),
            }
          : undefined,
      },
      include,
    })
    const after = await serializeBill(row, 0)
    await logFinanceAudit({
      actor: financeActorFromSession(gate.session),
      action: 'CREATE',
      entityType: 'PURCHASE_BILL',
      entityId: row.id,
      objectLabel: after.label,
      objectHref: `/admin/finance/purchase-bills?edit=${row.id}`,
      summary: `Created purchase bill ₹${after.totalAmount.toLocaleString('en-IN')}${
        after.supplierName ? ` — ${after.supplierName}` : ''
      }`,
      after,
    })
    return NextResponse.json(after, { status: 201 })
  } catch (err) {
    console.error('[finance.purchase-bills.POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 },
    )
  }
}
