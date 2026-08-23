import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit } from '@/lib/finance-audit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(1).optional(),
  type: z.enum(['CUSTOMER', 'VENDOR', 'OTHER']).optional(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const { id } = await params
  const existing = await prisma.financeContact.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data
  const row = await prisma.financeContact.update({
    where: { id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.type !== undefined ? { type: d.type } : {}),
      ...(d.email !== undefined
        ? { email: d.email?.trim() ? d.email.trim().toLowerCase() : null }
        : {}),
      ...(d.phone !== undefined ? { phone: d.phone?.trim() || null } : {}),
      ...(d.notes !== undefined ? { notes: d.notes?.trim() || null } : {}),
      ...(d.active !== undefined ? { active: d.active } : {}),
    },
  })
  await logFinanceAudit({
    actor: financeActorFromSession(gate.session),
    action: 'UPDATE',
    entityType: 'CONTACT',
    entityId: row.id,
    objectLabel: row.name,
    objectHref: '/admin/finance/config',
    summary: `Updated contact “${row.name}”`,
    before: serialize(existing),
    after: serialize(row),
  })
  return NextResponse.json(serialize(row))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const { id } = await params
  const existing = await prisma.financeContact.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const row = await prisma.financeContact.update({ where: { id }, data: { active: false } })
  await logFinanceAudit({
    actor: financeActorFromSession(gate.session),
    action: 'DELETE',
    entityType: 'CONTACT',
    entityId: row.id,
    objectLabel: existing.name,
    objectHref: '/admin/finance/config',
    summary: `Deactivated contact “${existing.name}”`,
    before: serialize(existing),
    after: serialize(row),
  })
  return NextResponse.json(serialize(row))
}
