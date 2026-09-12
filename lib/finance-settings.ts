import { prisma } from '@/lib/prisma'

export type FinanceKpiSettings = {
  cashInflowCategoryIds: string[]
  generalExpenseCategoryIds: string[]
}

const DEFAULTS: FinanceKpiSettings = {
  cashInflowCategoryIds: [],
  generalExpenseCategoryIds: [],
}

/** Load singleton FinanceSettings (id=1); creates row if missing. */
export async function getFinanceKpiSettings(): Promise<FinanceKpiSettings> {
  const existing = await prisma.financeSettings.findUnique({ where: { id: 1 } })
  if (existing) {
    return {
      cashInflowCategoryIds: existing.cashInflowCategoryIds ?? [],
      generalExpenseCategoryIds: existing.generalExpenseCategoryIds ?? [],
    }
  }
  try {
    const created = await prisma.financeSettings.create({
      data: {
        id: 1,
        cashInflowCategoryIds: [],
        generalExpenseCategoryIds: [],
      },
    })
    return {
      cashInflowCategoryIds: created.cashInflowCategoryIds ?? [],
      generalExpenseCategoryIds: created.generalExpenseCategoryIds ?? [],
    }
  } catch {
    const again = await prisma.financeSettings.findUnique({ where: { id: 1 } })
    if (again) {
      return {
        cashInflowCategoryIds: again.cashInflowCategoryIds ?? [],
        generalExpenseCategoryIds: again.generalExpenseCategoryIds ?? [],
      }
    }
    return { ...DEFAULTS }
  }
}
