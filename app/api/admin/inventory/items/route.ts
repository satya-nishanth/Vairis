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
  summarizeItemCreate,
} from '@/lib/inventory-audit'

export const dynamic = 'force-dynamic'

const createSchema = z
  .object({
    source: z.enum(['catalogue', 'custom']),
    productId: z.string().min(1).optional(),
    variantId: z.string().min(1).optional(),
    customName: z.string().trim().min(1).optional(),
    customDescription: z.string().trim().optional(),
    metalPurity: z.string().trim().optional(),
    weightGrams: z.number().positive().optional(),
    diamondCarats: z.number().min(0).max(1000).nullable().optional(),
    stoneCarats: z.number().min(0).max(1000).nullable().optional(),
    qtyOnHand: z.number().int().min(0).max(9999),
    purchasePrice: z.number().positive().max(100000000).nullable().optional(),
    soldPrice: z.number().positive().max(100000000).nullable().optional(),
    potentialPrice: z.number().positive().max(100000000).nullable().optional(),
    holderId: z.string().min(1),
    notes: z.string().trim().max(500).optional(),
    purchaseBillIds: z.array(z.string().min(1)).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.source === 'catalogue') {
      if (!d.variantId) {
        ctx.addIssue({ code: 'custom', message: 'Select a catalogue variant', path: ['variantId'] })
      }
    } else if (!d.customName) {
      ctx.addIssue({ code: 'custom', message: 'Item name is required', path: ['customName'] })
    }
  })

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  const isFinance = isFinanceEmail(session.user.email)
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const holderId = req.nextUrl.searchParams.get('holderId') ?? undefined
  const linked = req.nextUrl.searchParams.get('linked')

  const rows = await prisma.inventoryItem.findMany({
    where: {
      ...(holderId ? { holderId } : {}),
      ...(linked === '1' ? { variantId: { not: null } } : linked === '0' ? { variantId: null } : {}),
    },
    include: inventoryItemInclude,
    orderBy: { updatedAt: 'desc' },
    take: 500,
  })

  const filtered = q
    ? rows.filter((r) => {
        const hay = [
          r.customName,
          r.product?.name,
          r.product?.itemCode,
          r.variant?.sku,
          r.holder.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    : rows

  return NextResponse.json(filtered.map((r) => serializeInventoryItemForAdmin(r, isFinance)))
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  const isFinance = isFinanceEmail(session.user.email)
  const actor = inventoryActorFromSession(session)
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data

  if (!isFinance) {
    if (d.purchasePrice != null || d.potentialPrice != null) {
      return NextResponse.json(
        { error: 'Only finance admins can set purchase or potential price' },
        { status: 403 },
      )
    }
    if (d.purchaseBillIds && d.purchaseBillIds.length > 0) {
      return NextResponse.json(
        { error: 'Only finance admins can tag purchase bills' },
        { status: 403 },
      )
    }
  }

  const holder = await prisma.inventoryHolder.findUnique({ where: { id: d.holderId } })
  if (!holder) return NextResponse.json({ error: 'Holder not found' }, { status: 400 })

  let productId: string | null = null
  let variantId: string | null = null
  if (d.source === 'catalogue' && d.variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: d.variantId },
      include: { product: true },
    })
    if (!variant) return NextResponse.json({ error: 'Variant not found' }, { status: 400 })
    productId = variant.productId
    variantId = variant.id
  }

  const billIds = isFinance ? [...new Set(d.purchaseBillIds ?? [])] : []
  if (billIds.length) {
    const found = await prisma.purchaseBill.count({ where: { id: { in: billIds } } })
    if (found !== billIds.length) {
      return NextResponse.json({ error: 'One or more purchase bills not found' }, { status: 400 })
    }
  }

  const row = await prisma.inventoryItem.create({
    data: {
      productId,
      variantId,
      customName: d.source === 'custom' ? d.customName! : null,
      customDescription: d.customDescription || null,
      metalPurity: d.metalPurity || null,
      weightGrams: d.weightGrams ?? null,
      diamondCarats: d.diamondCarats ?? null,
      stoneCarats: d.stoneCarats ?? null,
      purchasePrice: isFinance ? (d.purchasePrice ?? null) : null,
      soldPrice: d.soldPrice ?? null,
      potentialPrice: isFinance ? (d.potentialPrice ?? null) : null,
      qtyOnHand: d.qtyOnHand,
      holderId: d.holderId,
      notes: d.notes || null,
      ...(billIds.length
        ? { purchaseBills: { create: billIds.map((purchaseBillId) => ({ purchaseBillId })) } }
        : {}),
    },
    include: inventoryItemInclude,
  })

  const snap = inventoryItemAuditSnap(row)
  const label = inventoryItemObjectLabel(row)
  await logInventoryAudit({
    actor,
    action: 'CREATE',
    entityType: 'ITEM',
    entityId: row.id,
    objectLabel: label,
    objectHref: inventoryItemHref(row.id),
    summary: summarizeItemCreate(snap),
    after: snap,
  })

  return NextResponse.json(serializeInventoryItemForAdmin(row, isFinance), { status: 201 })
}
