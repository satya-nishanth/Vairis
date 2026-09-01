import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { inventoryActorFromSession, logInventoryAudit } from '@/lib/inventory-audit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  const actor = inventoryActorFromSession(session)
  const { id } = await params
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data
  const existing = await prisma.inventoryHolder.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Holder not found' }, { status: 404 })

  try {
    const row = await prisma.inventoryHolder.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
        ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
      },
    })

    const parts: string[] = []
    if (d.name !== undefined && d.name !== existing.name) {
      parts.push(`renamed “${existing.name}” → “${row.name}”`)
    }
    if (d.active !== undefined && d.active !== existing.active) {
      parts.push(row.active ? 'activated' : 'deactivated')
    }
    if (d.sortOrder !== undefined && d.sortOrder !== existing.sortOrder) {
      parts.push('sort order updated')
    }

    await logInventoryAudit({
      actor,
      action: 'UPDATE',
      entityType: 'HOLDER',
      entityId: row.id,
      objectLabel: row.name,
      objectHref: '/admin/inventory/holders',
      summary: parts.length ? parts.join('; ') : `Updated holder “${row.name}”`,
      before: { id: existing.id, name: existing.name, active: existing.active, sortOrder: existing.sortOrder },
      after: { id: row.id, name: row.name, active: row.active, sortOrder: row.sortOrder },
    })

    return NextResponse.json(row)
  } catch {
    return NextResponse.json({ error: 'Holder not found' }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  const actor = inventoryActorFromSession(session)
  const { id } = await params
  const itemCount = await prisma.inventoryItem.count({ where: { holderId: id } })
  if (itemCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${itemCount} inventory line(s) still use this holder. Reassign or remove them first.` },
      { status: 400 },
    )
  }
  try {
    const existing = await prisma.inventoryHolder.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Holder not found' }, { status: 404 })

    await prisma.inventoryHolder.delete({ where: { id } })
    await logInventoryAudit({
      actor,
      action: 'DELETE',
      entityType: 'HOLDER',
      entityId: id,
      objectLabel: existing.name,
      objectHref: '/admin/inventory/holders',
      summary: `Deleted holder “${existing.name}”`,
      before: { id: existing.id, name: existing.name, active: existing.active },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Holder not found' }, { status: 404 })
  }
}
