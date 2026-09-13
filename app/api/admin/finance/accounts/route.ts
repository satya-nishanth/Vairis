import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { financeActorFromSession, logFinanceAudit } from '@/lib/finance-audit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Invalid email').optional().nullable().or(z.literal('')),
  type: z.enum(['PARTNER', 'COMPANY_BANK', 'CASH', 'VENDOR', 'OTHER']),
  isVendorWallet: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

function serialize(row: {
  id: string
  name: string
  email: string | null
  type: string
  isVendorWallet: boolean
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
  const rows = await prisma.financeAccount.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
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
  const email = d.email?.trim() ? d.email.trim().toLowerCase() : null
  try {
    const row = await prisma.financeAccount.create({
      data: {
        name: d.name,
        email,
        type: d.type,
        // Keep flag in sync with type so dashboard grouping stays consistent
        isVendorWallet: d.isVendorWallet ?? d.type === 'VENDOR',
        active: d.active ?? true,
        sortOrder: d.sortOrder ?? 0,
      },
    })
    await logFinanceAudit({
      actor: financeActorFromSession(gate.session),
      action: 'CREATE',
      entityType: 'ACCOUNT',
      entityId: row.id,
      objectLabel: row.name,
      objectHref: '/admin/finance/config',
      summary: `Created account “${row.name}” (${row.type}${row.isVendorWallet ? ', vendor wallet' : ''})`,
      after: serialize(row),
    })
    return NextResponse.json(serialize(row), { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Could not create account (email may already exist)' }, { status: 400 })
  }
}
