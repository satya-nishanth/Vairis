import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import {
  autoScopeInclude,
  normalizeScope,
  replaceAutomaticDiscountScopes,
} from '@/lib/discount-scope'

export const dynamic = 'force-dynamic'

const num = z.union([z.string(), z.number()]).transform(Number)

export const automaticDiscountSchema = z.object({
  name: z.string().trim().min(2).max(120),
  displayName: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null) return null
      const t = String(v).trim()
      return t ? t.slice(0, 120) : null
    }),
  percent: num.refine((n) => n > 0 && n <= 100, 'Percent must be 1–100'),
  maxDiscount: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  priority: num.refine((n) => Number.isFinite(n)).default(0),
  active: z.boolean().default(true),
  productIds: z.array(z.string()).optional(),
  collectionIds: z.array(z.string()).optional(),
  storeCategoryIds: z.array(z.string()).optional(),
  categories: z
    .array(z.enum(['RINGS', 'EARRINGS', 'PENDANTS', 'BRACELETS', 'NECKLACES']))
    .optional(),
})

export async function GET() {
  await requireAdmin()
  const rows = await prisma.automaticDiscount.findMany({
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    include: autoScopeInclude,
  })
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      displayName: r.displayName,
      percent: Number(r.percent),
      maxDiscount: r.maxDiscount != null ? Number(r.maxDiscount) : null,
      startsAt: r.startsAt?.toISOString() ?? null,
      endsAt: r.endsAt?.toISOString() ?? null,
      priority: r.priority,
      active: r.active,
      productIds: r.products.map((x) => x.productId),
      collectionIds: r.collections.map((x) => x.collectionId),
      storeCategoryIds: r.storeCategories.map((x) => x.storeCategoryId),
      categories: r.categories.map((x) => x.category),
    })),
  )
}

export async function POST(req: NextRequest) {
  await requireAdmin()
  const parsed = automaticDiscountSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid discount' },
      { status: 400 },
    )
  }
  const d = parsed.data
  const scope = normalizeScope(d)
  const row = await prisma.automaticDiscount.create({
    data: {
      name: d.name,
      displayName: d.displayName ?? null,
      percent: d.percent,
      maxDiscount: d.maxDiscount,
      startsAt: d.startsAt ? new Date(d.startsAt) : null,
      endsAt: d.endsAt ? new Date(d.endsAt) : null,
      priority: d.priority,
      active: d.active,
    },
  })
  await replaceAutomaticDiscountScopes(row.id, scope)
  return NextResponse.json(row, { status: 201 })
}
