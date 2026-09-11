import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type InventoryAuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'ALLOCATE' | 'RELEASE' | 'SOLD'
export type InventoryAuditEntity = 'ITEM' | 'HOLDER' | 'ALLOCATION' | 'SALE'

export type InventoryAuditActor = {
  actorEmail: string
  actorUserId?: string | null
}

export function inventoryDisplayName(row: {
  customName: string | null
  product: { name: string } | null
  variant: { sku: string; metalType: string; size: string | null } | null
}): string {
  if (row.product) {
    const v = row.variant
    const suffix = v ? ` · ${v.metalType}${v.size ? ` ${v.size}` : ''} (${v.sku})` : ''
    return `${row.product.name}${suffix}`
  }
  return row.customName?.trim() || 'Unnamed item'
}

export function inventoryActorFromSession(session: {
  user: { id: string; email?: string | null }
}): InventoryAuditActor {
  return {
    actorEmail: session.user.email?.trim().toLowerCase() || 'unknown',
    actorUserId: session.user.id,
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
  } catch {
    return { note: 'unserializable' }
  }
}

export function inventoryItemHref(id: string): string {
  return `/admin/inventory/${id}`
}

export function inventoryItemObjectLabel(row: {
  customName: string | null
  product: { name: string } | null
  variant: { sku: string; metalType: string; size: string | null } | null
}): string {
  return inventoryDisplayName(row)
}

export type InventoryItemAuditSnap = {
  id: string
  label: string
  qtyOnHand: number
  purchasePrice: number | null
  soldPrice: number | null
  potentialPrice: number | null
  holderName: string
  variantSku: string | null
  notes: string | null
}

export function inventoryItemAuditSnap(row: {
  id: string
  qtyOnHand: number
  purchasePrice?: { toString(): string } | number | null
  soldPrice?: { toString(): string } | number | null
  potentialPrice?: { toString(): string } | number | null
  notes: string | null
  customName: string | null
  product: { name: string } | null
  variant: { sku: string; metalType: string; size: string | null } | null
  holder: { name: string }
}): InventoryItemAuditSnap {
  return {
    id: row.id,
    label: inventoryItemObjectLabel(row),
    qtyOnHand: row.qtyOnHand,
    purchasePrice: row.purchasePrice != null ? Number(row.purchasePrice) : null,
    soldPrice: row.soldPrice != null ? Number(row.soldPrice) : null,
    potentialPrice: row.potentialPrice != null ? Number(row.potentialPrice) : null,
    holderName: row.holder.name,
    variantSku: row.variant?.sku ?? null,
    notes: row.notes,
  }
}

export function summarizeItemCreate(snap: InventoryItemAuditSnap): string {
  return `Added inventory line — qty ${snap.qtyOnHand}, holder ${snap.holderName}`
}

export function summarizeItemUpdate(before: InventoryItemAuditSnap, after: InventoryItemAuditSnap): string {
  const parts: string[] = []
  if (before.qtyOnHand !== after.qtyOnHand) {
    parts.push(`qty ${before.qtyOnHand} → ${after.qtyOnHand}`)
  }
  if (before.purchasePrice !== after.purchasePrice) {
    const fmt = (n: number | null) => (n != null ? `₹${n.toLocaleString('en-IN')}` : 'none')
    parts.push(`purchase ${fmt(before.purchasePrice)} → ${fmt(after.purchasePrice)}`)
  }
  if (before.soldPrice !== after.soldPrice) {
    const fmt = (n: number | null) => (n != null ? `₹${n.toLocaleString('en-IN')}` : 'none')
    parts.push(`sold ${fmt(before.soldPrice)} → ${fmt(after.soldPrice)}`)
  }
  if (before.potentialPrice !== after.potentialPrice) {
    const fmt = (n: number | null) => (n != null ? `₹${n.toLocaleString('en-IN')}` : 'none')
    parts.push(`potential ${fmt(before.potentialPrice)} → ${fmt(after.potentialPrice)}`)
  }
  if (before.holderName !== after.holderName) {
    parts.push(`holder ${before.holderName} → ${after.holderName}`)
  }
  if (before.label !== after.label) {
    parts.push(`item ${before.label} → ${after.label}`)
  }
  if (before.variantSku !== after.variantSku) {
    if (!before.variantSku && after.variantSku) {
      parts.push(`linked to ${after.variantSku}`)
    } else if (before.variantSku && after.variantSku) {
      parts.push(`variant ${before.variantSku} → ${after.variantSku}`)
    }
  }
  if (before.notes !== after.notes) {
    parts.push('notes updated')
  }
  return parts.length ? parts.join('; ') : 'Updated inventory line'
}

export function summarizeItemDelete(snap: InventoryItemAuditSnap): string {
  return `Deleted inventory line (qty was ${snap.qtyOnHand})`
}

export function summarizeAllocation(input: {
  qty: number
  itemLabel: string
  orderContactName: string
  qtyAfter: number
}): string {
  return `Allocated ${input.qty} unit(s) of “${input.itemLabel}” to order (${input.orderContactName}); qty now ${input.qtyAfter}`
}

export function summarizeRelease(input: {
  qty: number
  itemLabel: string
  orderContactName: string
  qtyAfter: number
}): string {
  return `Released ${input.qty} unit(s) of “${input.itemLabel}” from order (${input.orderContactName}); qty now ${input.qtyAfter}`
}

export function summarizeSale(input: {
  qty: number
  itemLabel: string
  orderLabel: string
  qtyAfter: number
}): string {
  return `Marked ${input.qty} unit(s) of “${input.itemLabel}” sold → ${input.orderLabel}; qty now ${input.qtyAfter}`
}

export async function logInventoryAudit(opts: {
  actor: InventoryAuditActor
  action: InventoryAuditAction
  entityType: InventoryAuditEntity
  entityId?: string | null
  objectLabel: string
  objectHref?: string | null
  summary: string
  before?: unknown
  after?: unknown
  tx?: Prisma.TransactionClient
}): Promise<void> {
  const client = opts.tx ?? prisma
  await client.inventoryAuditLog.create({
    data: {
      actorEmail: opts.actor.actorEmail,
      actorUserId: opts.actor.actorUserId ?? null,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      objectLabel: opts.objectLabel.slice(0, 200),
      objectHref: opts.objectHref ?? null,
      summary: opts.summary.slice(0, 500),
      before: toJson(opts.before) ?? undefined,
      after: toJson(opts.after) ?? undefined,
    },
  })
}
