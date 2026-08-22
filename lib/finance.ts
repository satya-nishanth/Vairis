import type { FinanceLineKind, FinancePaidTo, FinancePaidThrough, FinancePerson } from '@prisma/client'

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

export const FINANCE_PERSONS = ['ANIL', 'SURYA', 'VASU'] as const
export const PERSON_LABEL: Record<FinancePerson, string> = {
  ANIL: 'Anil',
  SURYA: 'Surya',
  VASU: 'Vasu',
}

export const FINANCE_LINE_KINDS = [
  'DELIVERY',
  'GOLD',
  'STONES',
  'DIAMONDS',
  'MAKING_CHARGES',
  'WASTAGE_CHARGES',
] as const

export const LINE_KIND_LABEL: Record<FinanceLineKind, string> = {
  DELIVERY: 'Delivery',
  GOLD: 'Gold',
  STONES: 'Stones',
  DIAMONDS: 'Diamonds',
  MAKING_CHARGES: 'Making charges',
  WASTAGE_CHARGES: 'Wastage charges',
}

export type FinanceLineInput = {
  kind: FinanceLineKind
  costPrice: number
  sellingPrice: number
}

export function sheetTotals(lines: FinanceLineInput[]): { cost: number; selling: number; profit: number } {
  const cost = roundMoney(lines.reduce((s, l) => s + l.costPrice, 0))
  const selling = roundMoney(lines.reduce((s, l) => s + l.sellingPrice, 0))
  return { cost, selling, profit: orderProfit(selling, cost) }
}

export function orderProfit(sellingPrice: number, cost: number): number {
  return roundMoney(sellingPrice - cost)
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** Calendar year/month in IST for a UTC timestamp. month is 1–12. */
export function istYearMonth(d: Date): { year: number; month: number } {
  const ist = new Date(d.getTime() + IST_OFFSET_MS)
  return { year: ist.getUTCFullYear(), month: ist.getUTCMonth() + 1 }
}

/** [start, end) UTC instants covering one IST calendar month. */
export function istMonthUtcRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET_MS)
  const end = new Date(Date.UTC(year, month, 1) - IST_OFFSET_MS)
  return { start, end }
}

/** Store an <input type="date"> value as that IST calendar day. */
export function dateInputToIstDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00+05:30`)
}

export function toDateInput(d: Date): string {
  const { year, month } = istYearMonth(d)
  const ist = new Date(d.getTime() + IST_OFFSET_MS)
  const day = ist.getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export type ExpenseRow = {
  date: Date
  amount: number
  paidThrough: FinancePaidThrough
  contributor: FinancePerson | null
}

export type OrderSheetRow = {
  orderCreatedAt: Date
  cost: number
  sellingPrice: number
  customerPaidTo: FinancePaidTo
}

export type PersonTotals = {
  person: FinancePerson
  contribution: number
  receiptsHeld: number
}

export type FinanceSummary = {
  income: number
  orderCost: number
  generalExpenses: number
  profit: number
  byPerson: PersonTotals[]
}

export function summarizeFinance(
  expenses: ExpenseRow[],
  sheets: OrderSheetRow[],
  range?: { start: Date; end: Date },
): FinanceSummary {
  const inRange = (d: Date) => !range || (d >= range.start && d < range.end)
  const ex = expenses.filter((e) => inRange(e.date))
  const sh = sheets.filter((s) => inRange(s.orderCreatedAt))

  const generalExpenses = roundMoney(ex.reduce((s, e) => s + e.amount, 0))
  const income = roundMoney(sh.reduce((s, r) => s + r.sellingPrice, 0))
  const cp = roundMoney(sh.reduce((s, r) => s + r.cost, 0))
  const orderProfitSum = roundMoney(sh.reduce((s, r) => s + orderProfit(r.sellingPrice, r.cost), 0))

  const byPerson: PersonTotals[] = FINANCE_PERSONS.map((person) => ({
    person,
    contribution: roundMoney(
      ex
        .filter((e) => e.paidThrough === 'PERSONAL_FUNDS' && e.contributor === person)
        .reduce((s, e) => s + e.amount, 0),
    ),
    receiptsHeld: roundMoney(
      sh.filter((r) => r.customerPaidTo === person).reduce((s, r) => s + r.sellingPrice, 0),
    ),
  }))

  return {
    income,
    orderCost: cp,
    generalExpenses,
    profit: roundMoney(orderProfitSum - generalExpenses),
    byPerson,
  }
}
