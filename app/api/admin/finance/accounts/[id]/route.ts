import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit } from '@/lib/finance-audit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Invalid email').optional().nullable().or(z.literal('')),
  type: z.enum(['PARTNER', 'COMPANY_BANK', 'CASH', 'VENDOR', 'VAULT', 'OTHER']).optional(),
  isVendorWallet: z.boolean().optional(),
  vendorOutflowSource: z.enum(['ORDER_SHEETS', 'TRANSACTIONS', 'BOTH']).optional(),
  vaultPurityK: z.number().positive('Vault purity must be > 0').max(24, 'Vault purity max is 24K').optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

function serialize(row: {
  id: string
  name: string
  email: string | null
  type: string
  isVendorWallet: boolean
  vendorOutflowSource: string
  vaultPurityK: number
  active: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    type: row.type,
    isVendorWallet: row.isVendorWallet,
    vendorOutflowSource: row.vendorOutflowSource,
    vaultPurityK: row.vaultPurityK,
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
  const existing = await prisma.financeAccount.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data
  try {
    const nextIsVendor =
      d.type !== undefined
        ? (d.isVendorWallet ?? d.type === 'VENDOR')
        : d.isVendorWallet !== undefined
          ? d.isVendorWallet
          : existing.isVendorWallet
    const nextType = d.type ?? existing.type
    const row = await prisma.financeAccount.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.email !== undefined
          ? { email: d.email?.trim() ? d.email.trim().toLowerCase() : null }
          : {}),
        ...(d.type !== undefined ? { type: d.type } : {}),
        ...(d.type !== undefined || d.isVendorWallet !== undefined
          ? { isVendorWallet: nextIsVendor }
          : {}),
        ...(d.vendorOutflowSource !== undefined && nextIsVendor
          ? { vendorOutflowSource: d.vendorOutflowSource }
          : {}),
        ...(nextType === 'VAULT' && d.vaultPurityK !== undefined
          ? { vaultPurityK: d.vaultPurityK }
          : nextType !== 'VAULT' && d.type !== undefined
            ? { vaultPurityK: 24 }
            : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
        ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
      },
    })
    await logFinanceAudit({
      actor: financeActorFromSession(gate.session),
      action: 'UPDATE',
      entityType: 'ACCOUNT',
      entityId: row.id,
      objectLabel: row.name,
      objectHref: '/admin/finance/config',
      summary: `Updated account “${row.name}”`,
      before: serialize(existing),
      after: serialize(row),
    })
    return NextResponse.json(serialize(row))
  } catch {
    return NextResponse.json({ error: 'Could not update account (email may already exist)' }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const { id } = await params
  const existing = await prisma.financeAccount.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Soft-deactivate to preserve FK history
  const row = await prisma.financeAccount.update({ where: { id }, data: { active: false } })
  await logFinanceAudit({
    actor: financeActorFromSession(gate.session),
    action: 'DELETE',
    entityType: 'ACCOUNT',
    entityId: row.id,
    objectLabel: existing.name,
    objectHref: '/admin/finance/config',
    summary: `Deactivated account “${existing.name}”`,
    before: serialize(existing),
    after: serialize(row),
  })
  return NextResponse.json(serialize(row))
}
