import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { isFinanceEmail } from '@/lib/finance-auth'
import { prisma } from '@/lib/prisma'
import { inventoryItemInclude, serializeInventoryItemForAdmin } from '@/lib/inventory'
import {
  inventoryActorFromSession,
  inventoryItemAuditSnap,
  inventoryItemHref,
  inventoryItemObjectLabel,
  logInventoryAudit,
  summarizeItemDelete,
  summarizeItemUpdate,
} from '@/lib/inventory-audit'

export const dynamic = 'force-dynamic'

const patchSchema = z
  .object({
    variantId: z.string().min(1).nullable().optional(),
    productId: z.string().min(1).nullable().optional(),
    customName: z.string().trim().min(1).optional(),
    customDescription: z.string().trim().nullable().optional(),
    metalPurity: z.string().trim().nullable().optional(),
    weightGrams: z.number().positive().nullable().optional(),
    diamondCarats: z.number().min(0).max(1000).nullable().optional(),
    stoneCarats: z.number().min(0).max(1000).nullable().optional(),
    qtyOnHand: z.number().int().min(0).max(9999).optional(),
    purchasePrice: z.number().positive().max(100000000).nullable().optional(),
    soldPrice: z.number().positive().max(100000000).nullable().optional(),
    potentialPrice: z.number().positive().max(100000000).nullable().optional(),
    holderId: z.string().min(1).optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    linkVariantId: z.string().min(1).optional(),
    purchaseBillIds: z.array(z.string().min(1)).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.linkVariantId && d.variantId === null) {
      ctx.addIssue({ code: 'custom', message: 'Use linkVariantId to link to catalogue' })
    }
  })

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  const isFinance = isFinanceEmail(session.user.email)
  const { id } = await params
  const row = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      ...inventoryItemInclude,
      allocations: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          order: { select: { id: true, contactName: true, status: true, createdAt: true } },
        },
      },
    },
  })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(serializeInventoryItemForAdmin(row, isFinance))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  const isFinance = isFinanceEmail(session.user.email)
  const actor = inventoryActorFromSession(session)
  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data

  if (!isFinance) {
    if (d.purchasePrice !== undefined || d.potentialPrice !== undefined) {
      return NextResponse.json(
        { error: 'Only finance admins can set purchase or potential price' },
        { status: 403 },
      )
    }
    if (d.purchaseBillIds !== undefined) {
      return NextResponse.json(
        { error: 'Only finance admins can tag purchase bills' },
        { status: 403 },
      )
    }
  }

  const existing = await prisma.inventoryItem.findUnique({
    where: { id },
    include: inventoryItemInclude,
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const beforeSnap = inventoryItemAuditSnap(existing)

  let productId = d.productId
  let variantId = d.variantId
  if (d.linkVariantId) {
    const variant = await prisma.productVariant.findUnique({ where: { id: d.linkVariantId } })
    if (!variant) return NextResponse.json({ error: 'Variant not found' }, { status: 400 })
    productId = variant.productId
    variantId = variant.id
  }

  if (d.holderId) {
    const holder = await prisma.inventoryHolder.findUnique({ where: { id: d.holderId } })
    if (!holder) return NextResponse.json({ error: 'Holder not found' }, { status: 400 })
  }

  const billIds =
    isFinance && d.purchaseBillIds !== undefined ? [...new Set(d.purchaseBillIds)] : null
  if (billIds) {
    const found = await prisma.purchaseBill.count({ where: { id: { in: billIds } } })
    if (found !== billIds.length) {
      return NextResponse.json({ error: 'One or more purchase bills not found' }, { status: 400 })
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    if (billIds) {
      await tx.inventoryItemPurchaseBill.deleteMany({ where: { inventoryItemId: id } })
      if (billIds.length) {
        await tx.inventoryItemPurchaseBill.createMany({
          data: billIds.map((purchaseBillId) => ({ inventoryItemId: id, purchaseBillId })),
        })
      }
    }
    return tx.inventoryItem.update({
      where: { id },
      data: {
        ...(productId !== undefined ? { productId } : {}),
        ...(variantId !== undefined ? { variantId } : {}),
        ...(d.customName !== undefined ? { customName: d.customName } : {}),
        ...(d.customDescription !== undefined ? { customDescription: d.customDescription } : {}),
        ...(d.metalPurity !== undefined ? { metalPurity: d.metalPurity } : {}),
        ...(d.weightGrams !== undefined ? { weightGrams: d.weightGrams } : {}),
        ...(d.diamondCarats !== undefined ? { diamondCarats: d.diamondCarats } : {}),
        ...(d.stoneCarats !== undefined ? { stoneCarats: d.stoneCarats } : {}),
        ...(isFinance && d.purchasePrice !== undefined ? { purchasePrice: d.purchasePrice } : {}),
        ...(d.soldPrice !== undefined ? { soldPrice: d.soldPrice } : {}),
        ...(isFinance && d.potentialPrice !== undefined ? { potentialPrice: d.potentialPrice } : {}),
        ...(d.qtyOnHand !== undefined ? { qtyOnHand: d.qtyOnHand } : {}),
        ...(d.holderId !== undefined ? { holderId: d.holderId } : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
      },
      include: inventoryItemInclude,
    })
  })

  const afterSnap = inventoryItemAuditSnap(row)
  const label = inventoryItemObjectLabel(row)
  await logInventoryAudit({
    actor,
    action: 'UPDATE',
    entityType: 'ITEM',
    entityId: row.id,
    objectLabel: label,
    objectHref: inventoryItemHref(row.id),
    summary: summarizeItemUpdate(beforeSnap, afterSnap),
    before: beforeSnap,
    after: afterSnap,
  })

  return NextResponse.json(serializeInventoryItemForAdmin(row, isFinance))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  const actor = inventoryActorFromSession(session)
  const { id } = await params
  const allocCount = await prisma.inventoryAllocation.count({ where: { inventoryItemId: id } })
  if (allocCount > 0) {
    return NextResponse.json(
      { error: 'Cannot delete — this item has order allocations. Set qty to 0 instead.' },
      { status: 400 },
    )
  }
  try {
    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
      include: inventoryItemInclude,
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const snap = inventoryItemAuditSnap(existing)
    const label = inventoryItemObjectLabel(existing)
    await prisma.inventoryItem.delete({ where: { id } })
    await logInventoryAudit({
      actor,
      action: 'DELETE',
      entityType: 'ITEM',
      entityId: id,
      objectLabel: label,
      objectHref: null,
      summary: summarizeItemDelete(snap),
      before: snap,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
