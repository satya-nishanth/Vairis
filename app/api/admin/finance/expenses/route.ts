import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { dateInputToIstDate } from '@/lib/finance'

export const dynamic = 'force-dynamic'

const PERSONS = ['ANIL', 'SURYA', 'VASU'] as const

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date is required'),
  description: z.string().trim().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  paidThrough: z.enum(['VAIRIS_BANK', 'PERSONAL_FUNDS']),
  contributor: z.enum(PERSONS).optional().nullable(),
}).superRefine((d, ctx) => {
  if (d.paidThrough === 'PERSONAL_FUNDS' && !d.contributor) {
    ctx.addIssue({ code: 'custom', path: ['contributor'], message: 'Contributor is required for personal funds' })
  }
})

function serialize(row: {
  id: string
  date: Date
  description: string
  amount: { toString(): string } | number
  paidThrough: string
  contributor: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    date: row.date.toISOString(),
    description: row.description,
    amount: Number(row.amount),
    paidThrough: row.paidThrough,
    contributor: row.contributor,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function GET() {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const rows = await prisma.generalExpense.findMany({ orderBy: { date: 'desc' } })
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
  const row = await prisma.generalExpense.create({
    data: {
      date: dateInputToIstDate(d.date),
      description: d.description,
      amount: d.amount,
      paidThrough: d.paidThrough,
      contributor: d.paidThrough === 'PERSONAL_FUNDS' ? d.contributor! : null,
    },
  })
  return NextResponse.json(serialize(row), { status: 201 })
}
