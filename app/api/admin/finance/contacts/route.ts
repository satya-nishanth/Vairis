import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit } from '@/lib/finance-audit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  type: z.enum(['CUSTOMER', 'VENDOR', 'OTHER']),
  email: z.string().trim().email('Invalid email').optional().nullable().or(z.literal('')),
  phone: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
})

function serialize(row: {
  id: string
  name: string
  type: string
  email: string | null
  phone: string | null
  notes: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const activeOnly = req.nextUrl.searchParams.get('active') === '1'
  const rows = await prisma.financeContact.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { name: 'asc' },
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
  const row = await prisma.financeContact.create({
    data: {
      name: d.name,
      type: d.type,
      email: d.email?.trim() ? d.email.trim().toLowerCase() : null,
      phone: d.phone?.trim() || null,
      notes: d.notes?.trim() || null,
      active: d.active ?? true,
    },
  })
  await logFinanceAudit({
    actor: financeActorFromSession(gate.session),
    action: 'CREATE',
    entityType: 'CONTACT',
    entityId: row.id,
    objectLabel: row.name,
    objectHref: '/admin/finance/config',
    summary: `Created contact “${row.name}” (${row.type})`,
    after: serialize(row),
  })
  return NextResponse.json(serialize(row), { status: 201 })
}
