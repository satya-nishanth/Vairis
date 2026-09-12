import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { upsertOrderFinanceSheet } from '@/lib/finance-order-sheet-upsert'
import { FINANCE_LINE_KINDS, sheetTotals } from '@/lib/finance'
import type { FinanceLineKind } from '@prisma/client'

export const dynamic = 'force-dynamic'

const lineSchema = z.object({
  kind: z.enum(FINANCE_LINE_KINDS),
  costPrice: z.number().min(0),
  sellingPrice: z.number().min(0),
})

const upsertSchema = z.object({
  orderId: z.string().min(1),
  paidToAccountId: z.string().min(1, 'Paid-to account is required'),
  lines: z.array(lineSchema).min(1, 'Add at least one line'),
  roundOffEnabled: z.boolean().optional(),
})

const sheetInclude = {
  lines: true,
  paidToAccount: { select: { id: true, name: true } },
  order: { select: { contactName: true, createdAt: true, grandTotal: true } },
} as const

function serialize(row: {
  id: string
  orderId: string
  paidToAccountId: string
  roundOffEnabled: boolean
  lines: {
    kind: FinanceLineKind
    costPrice: { toString(): string } | number
    sellingPrice: { toString(): string } | number
    sortOrder: number
  }[]
  paidToAccount?: { id: string; name: string }
  order?: { contactName: string; grandTotal: { toString(): string } | number }
}) {
  const lines = [...row.lines]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => ({
      kind: l.kind,
      costPrice: Number(l.costPrice),
      sellingPrice: Number(l.sellingPrice),
    }))
  const totals = sheetTotals(lines, { roundOffEnabled: row.roundOffEnabled })
  return {
    id: row.id,
    orderId: row.orderId,
    paidToAccountId: row.paidToAccountId,
    paidToAccountName: row.paidToAccount?.name ?? null,
    customerPaidTo: row.paidToAccountId,
    roundOffEnabled: row.roundOffEnabled,
    roundOff: totals.roundOff,
    lines,
    cost: totals.cost,
    sellingPrice: totals.selling,
    sellingRaw: totals.sellingRaw,
    profit: totals.profit,
    order: row.order
      ? { contactName: row.order.contactName, grandTotal: Number(row.order.grandTotal) }
      : undefined,
  }
}

export async function GET(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error

  const orderId = req.nextUrl.searchParams.get('orderId')?.trim()
  if (orderId) {
    const row = await prisma.orderFinance.findUnique({
      where: { orderId },
      include: sheetInclude,
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(serialize(row))
  }

  const rows = await prisma.orderFinance.findMany({
    orderBy: { updatedAt: 'desc' },
    include: sheetInclude,
  })
  return NextResponse.json(rows.map(serialize))
}

export async function POST(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const parsed = upsertSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  try {
    const after = await upsertOrderFinanceSheet(parsed.data, gate.session)
    return NextResponse.json(after)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Save failed'
    const status = msg === 'Order not found' ? 404 : msg === 'Account not found' ? 400 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
