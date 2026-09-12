import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinance } from '@/lib/finance-auth'
import { getFinanceKpiSettings } from '@/lib/finance-settings'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  cashInflowCategoryIds: z.array(z.string().min(1)).optional(),
  generalExpenseCategoryIds: z.array(z.string().min(1)).optional(),
})

export async function GET() {
  await requireFinance()
  const settings = await getFinanceKpiSettings()
  return NextResponse.json(settings)
}

export async function PATCH(req: Request) {
  await requireFinance()
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const current = await getFinanceKpiSettings()
  const cashInflowCategoryIds =
    parsed.data.cashInflowCategoryIds !== undefined
      ? [...new Set(parsed.data.cashInflowCategoryIds)]
      : current.cashInflowCategoryIds
  const generalExpenseCategoryIds =
    parsed.data.generalExpenseCategoryIds !== undefined
      ? [...new Set(parsed.data.generalExpenseCategoryIds)]
      : current.generalExpenseCategoryIds

  // Validate ids exist and match expected direction
  const ids = [...new Set([...cashInflowCategoryIds, ...generalExpenseCategoryIds])]
  if (ids.length > 0) {
    const cats = await prisma.financeCategory.findMany({
      where: { id: { in: ids }, active: true },
      select: { id: true, direction: true },
    })
    const byId = new Map(cats.map((c) => [c.id, c.direction]))
    for (const id of cashInflowCategoryIds) {
      if (byId.get(id) !== 'INFLOW') {
        return NextResponse.json(
          { error: 'Cash inflow categories must be active INFLOW categories' },
          { status: 400 },
        )
      }
    }
    for (const id of generalExpenseCategoryIds) {
      if (byId.get(id) !== 'OUTFLOW') {
        return NextResponse.json(
          { error: 'General expense categories must be active OUTFLOW categories' },
          { status: 400 },
        )
      }
    }
  }

  const row = await prisma.financeSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      cashInflowCategoryIds,
      generalExpenseCategoryIds,
    },
    update: {
      cashInflowCategoryIds,
      generalExpenseCategoryIds,
    },
  })

  return NextResponse.json({
    cashInflowCategoryIds: row.cashInflowCategoryIds,
    generalExpenseCategoryIds: row.generalExpenseCategoryIds,
  })
}
