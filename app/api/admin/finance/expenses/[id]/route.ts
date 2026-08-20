import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { dateInputToIstDate } from '@/lib/finance'

export const dynamic = 'force-dynamic'

const PERSONS = ['ANIL', 'SURYA', 'VASU'] as const

const patchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().trim().min(1).optional(),
  amount: z.number().positive().optional(),
  paidThrough: z.enum(['VAIRIS_BANK', 'PERSONAL_FUNDS']).optional(),
  contributor: z.enum(PERSONS).optional().nullable(),
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
  let contributor = parsed.data.contributor === undefined ? existing.contributor : parsed.data.contributor
  if (nextThrough === 'VAIRIS_BANK') contributor = null
  if (nextThrough === 'PERSONAL_FUNDS' && !contributor) {
    return NextResponse.json({ error: 'Contributor is required for personal funds' }, { status: 400 })
  }

  const row = await prisma.generalExpense.update({
    where: { id },
    data: {
      date: parsed.data.date ? dateInputToIstDate(parsed.data.date) : undefined,
      description: parsed.data.description,
      amount: parsed.data.amount,
      paidThrough: parsed.data.paidThrough,
      contributor,
    },
  })
  return NextResponse.json({
    id: row.id,
    date: row.date.toISOString(),
    description: row.description,
    amount: Number(row.amount),
    paidThrough: row.paidThrough,
    contributor: row.contributor,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const { id } = await params
  try {
    await prisma.generalExpense.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return new NextResponse(null, { status: 204 })
}
