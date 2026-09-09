import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit } from '@/lib/finance-audit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(1).optional(),
  direction: z.enum(['INFLOW', 'OUTFLOW']).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

function serialize(row: {
  id: string
  name: string
  direction: string
  active: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    name: row.name,
    direction: row.direction as 'INFLOW' | 'OUTFLOW',
    active: row.active,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const { id } = await params
  const existing = await prisma.financeCategory.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data
  const nextDir = d.direction ?? existing.direction
  const nextName = d.name ?? existing.name
  if (d.name || d.direction) {
    const clash = await prisma.financeCategory.findFirst({
      where: {
        direction: nextDir,
        name: { equals: nextName, mode: 'insensitive' },
        NOT: { id },
      },
    })
    if (clash) {
      return NextResponse.json(
        { error: `A ${nextDir === 'INFLOW' ? 'inflow' : 'outflow'} category with this name already exists` },
        { status: 400 },
      )
    }
  }
  const row = await prisma.financeCategory.update({
    where: { id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.direction !== undefined ? { direction: d.direction } : {}),
      ...(d.active !== undefined ? { active: d.active } : {}),
      ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
    },
  })
  await logFinanceAudit({
    actor: financeActorFromSession(gate.session),
    action: 'UPDATE',
    entityType: 'CATEGORY',
    entityId: row.id,
    objectLabel: row.name,
    objectHref: '/admin/finance/config',
    summary: `Updated category “${row.name}”`,
    before: serialize(existing),
    after: serialize(row),
  })
  return NextResponse.json(serialize(row))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const { id } = await params
  const existing = await prisma.financeCategory.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const row = await prisma.financeCategory.update({ where: { id }, data: { active: false } })
  await logFinanceAudit({
    actor: financeActorFromSession(gate.session),
    action: 'DELETE',
    entityType: 'CATEGORY',
    entityId: row.id,
    objectLabel: existing.name,
    objectHref: '/admin/finance/config',
    summary: `Deactivated category “${existing.name}”`,
    before: serialize(existing),
    after: serialize(row),
  })
  return NextResponse.json(serialize(row))
}
