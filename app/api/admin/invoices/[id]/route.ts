import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  invoiceStatusFromPayload,
  totalsFromPayload,
  type InvoicePayload,
} from '@/lib/invoice-document'

export const dynamic = 'force-dynamic'

function serialize(inv: {
  id: string
  number: string
  orderId: string | null
  status: string
  payload: unknown
  taxableValue: { toString(): string } | number
  gstAmount: { toString(): string } | number
  grandTotal: { toString(): string } | number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: inv.id,
    number: inv.number,
    orderId: inv.orderId,
    status: inv.status,
    payload: inv.payload,
    taxableValue: Number(inv.taxableValue),
    gstAmount: Number(inv.gstAmount),
    grandTotal: Number(inv.grandTotal),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(serialize(invoice))
}

const patchSchema = z.object({
  payload: z.unknown(),
  status: z.enum(['PAID', 'UNPAID']).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const existing = await prisma.invoice.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const payload = parsed.data.payload as InvoicePayload
  const totals = totalsFromPayload(payload)
  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      payload: { ...payload, lines: totals.lines } as object,
      taxableValue: totals.taxable,
      gstAmount: totals.gstAmount,
      grandTotal: totals.grandTotal,
      status: parsed.data.status ?? invoiceStatusFromPayload(payload),
    },
  })
  return NextResponse.json(serialize(invoice))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  try {
    await prisma.invoice.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return new NextResponse(null, { status: 204 })
}
