import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { inventoryActorFromSession, logInventoryAudit } from '@/lib/inventory-audit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function GET(req: NextRequest) {
  await requireAdmin()
  const activeOnly = req.nextUrl.searchParams.get('active') === '1'
  const rows = await prisma.inventoryHolder.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  const actor = inventoryActorFromSession(session)
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data
  const row = await prisma.inventoryHolder.create({
    data: {
      name: d.name,
      active: d.active ?? true,
      sortOrder: d.sortOrder ?? 0,
    },
  })

  await logInventoryAudit({
    actor,
    action: 'CREATE',
    entityType: 'HOLDER',
    entityId: row.id,
    objectLabel: row.name,
    objectHref: '/admin/inventory/holders',
    summary: `Added holder “${row.name}”`,
    after: { id: row.id, name: row.name, active: row.active },
  })

  return NextResponse.json(row, { status: 201 })
}
