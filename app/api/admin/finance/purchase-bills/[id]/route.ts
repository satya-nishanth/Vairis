import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit } from '@/lib/finance-audit'
import { dateInputToIstDate, shortFinanceId, toDateInput } from '@/lib/finance'
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
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  billNumber: z.string().trim().optional(),
  supplierContactId: z.string().nullable().optional(),
  supplierName: z.string().trim().optional(),
  description: z.string().trim().optional(),
  gstAmount: z.number().min(0).optional(),
  totalAmount: z.number().positive().optional(),
  notes: z.string().trim().optional(),
  lines: z.array(lineSchema).optional(),
  attachments: z.array(attachmentSchema).optional(),
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

async function resolveSupplier(contactId: string | null | undefined, name: string | undefined) {
  if (contactId === undefined && name === undefined) return null
  const trimmed = (name ?? '').trim()
  if (contactId) {
    const contact = await prisma.financeContact.findFirst({ where: { id: contactId, active: true } })
    if (!contact) return { error: 'Supplier contact not found' as const }
    return { supplierContactId: contact.id, supplierName: contact.name }
  }
  return { supplierContactId: null, supplierName: trimmed }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const { id } = await params
  const existing = await prisma.purchaseBill.findUnique({ where: { id }, include })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data
  const paidMap = await collectedByPurchaseBillIds([id])
  const before = await serializeBill(existing, paidMap.get(id) ?? 0)

  const resolved = await resolveSupplier(d.supplierContactId, d.supplierName)
  if (resolved && 'error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 })
  }

  const row = await prisma.$transaction(async (tx) => {
    if (d.lines !== undefined) {
      await tx.purchaseBillLine.deleteMany({ where: { billId: id } })
      if (d.lines.length) {
        await tx.purchaseBillLine.createMany({
          data: d.lines.map((l, i) => ({
            billId: id,
            description: l.description ?? '',
            amount: l.amount,
            sortOrder: i,
          })),
        })
      }
    }
    if (d.attachments !== undefined) {
      await tx.purchaseBillAttachment.deleteMany({ where: { billId: id } })
      if (d.attachments.length) {
        await tx.purchaseBillAttachment.createMany({
          data: d.attachments.map((a) => ({
            billId: id,
            url: a.url,
            fileName: a.fileName,
            contentType: a.contentType ?? '',
          })),
        })
      }
    }
    return tx.purchaseBill.update({
      where: { id },
      data: {
        ...(d.date !== undefined ? { date: dateInputToIstDate(d.date) } : {}),
        ...(d.billNumber !== undefined ? { billNumber: d.billNumber } : {}),
        ...(resolved
          ? {
              supplierContactId: resolved.supplierContactId,
              supplierName: resolved.supplierName,
            }
          : {}),
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.gstAmount !== undefined ? { gstAmount: d.gstAmount } : {}),
        ...(d.totalAmount !== undefined ? { totalAmount: d.totalAmount } : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
      },
      include,
    })
  })

  const after = await serializeBill(row, paidMap.get(id) ?? 0)
  await logFinanceAudit({
    actor: financeActorFromSession(gate.session),
    action: 'UPDATE',
    entityType: 'PURCHASE_BILL',
    entityId: id,
    objectLabel: after.label,
    objectHref: `/admin/finance/purchase-bills?edit=${id}`,
    summary: `Updated purchase bill ₹${after.totalAmount.toLocaleString('en-IN')}`,
    before,
    after,
  })
  return NextResponse.json(after)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const { id } = await params
  const existing = await prisma.purchaseBill.findUnique({ where: { id }, include })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const paidMap = await collectedByPurchaseBillIds([id])
  const before = await serializeBill(existing, paidMap.get(id) ?? 0)
  await prisma.purchaseBill.delete({ where: { id } })
  await logFinanceAudit({
    actor: financeActorFromSession(gate.session),
    action: 'DELETE',
    entityType: 'PURCHASE_BILL',
    entityId: id,
    objectLabel: before.label,
    objectHref: '/admin/finance/purchase-bills',
    summary: `Deleted purchase bill ₹${before.totalAmount.toLocaleString('en-IN')}`,
    before,
  })
  return NextResponse.json({ ok: true })
}
