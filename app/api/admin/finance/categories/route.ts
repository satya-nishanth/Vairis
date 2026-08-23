import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit } from '@/lib/finance-audit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  direction: z.enum(['INFLOW', 'OUTFLOW']),
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

export async function GET(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const activeOnly = req.nextUrl.searchParams.get('active') === '1'
  const direction = req.nextUrl.searchParams.get('direction')
  const dir =
    direction === 'INFLOW' || direction === 'OUTFLOW' ? direction : undefined
  const rows = await prisma.financeCategory.findMany({
    where: {
      ...(activeOnly ? { active: true } : {}),
      ...(dir ? { direction: dir } : {}),
    },
    orderBy: [{ direction: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
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
  const existing = await prisma.financeCategory.findFirst({
    where: {
      direction: d.direction,
      name: { equals: d.name, mode: 'insensitive' },
    },
  })
  if (existing) {
    return NextResponse.json(
      { error: `A ${d.direction === 'INFLOW' ? 'inflow' : 'outflow'} category with this name already exists` },
      { status: 400 },
    )
  }
  const maxSort = await prisma.financeCategory.aggregate({
    where: { direction: d.direction },
    _max: { sortOrder: true },
  })
  const row = await prisma.financeCategory.create({
    data: {
      name: d.name,
      direction: d.direction,
      active: d.active ?? true,
      sortOrder: d.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
    },
  })
  await logFinanceAudit({
    actor: financeActorFromSession(gate.session),
    action: 'CREATE',
    entityType: 'CATEGORY',
    entityId: row.id,
    objectLabel: row.name,
    objectHref: '/admin/finance/config',
    summary: `Created ${row.direction.toLowerCase()} category “${row.name}”`,
    after: serialize(row),
  })
  return NextResponse.json(serialize(row), { status: 201 })
}
