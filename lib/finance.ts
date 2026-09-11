import type { FinanceAccountType, FinanceLineKind, FinancePaidThrough } from '@prisma/client'

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

export const FINANCE_LINE_KINDS = [
  'GOLD',
  'DIAMONDS',
  'STONES',
  'MAKING_CHARGES',
  'WASTAGE_CHARGES',
  'DELIVERY',
  'GST',
] as const

export const LINE_KIND_LABEL: Record<FinanceLineKind, string> = {
  DELIVERY: 'Delivery',
  GST: 'GST',
  GOLD: 'Gold',
  STONES: 'Stones',
  DIAMONDS: 'Diamonds',
  MAKING_CHARGES: 'Making charges',
  WASTAGE_CHARGES: 'Wastage charges',
}

export const ACCOUNT_TYPE_LABEL: Record<FinanceAccountType, string> = {
  PARTNER: 'Partner',
  COMPANY_BANK: 'Company bank',
  CASH: 'Cash',
  OTHER: 'Other',
}

/** Category config — inflow/outflow only (TRANSFER is for transactions, not categories). */
export type FinanceCategoryDirection = 'INFLOW' | 'OUTFLOW'

export type FinanceTransactionDirection = 'INFLOW' | 'OUTFLOW' | 'TRANSFER'

export function toFinanceCategoryDirection(value: string): FinanceCategoryDirection {
  return value === 'INFLOW' ? 'INFLOW' : 'OUTFLOW'
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

/**
 * Order sheet is complete when every line with a selling price has a
 * non-zero purchase/cost price. No sheet → not complete.
 */
export function isOrderSheetComplete(
  lines: { costPrice: number; sellingPrice: number }[] | null | undefined,
): boolean {
  if (!lines) return false
  return lines.every((l) => {
    const selling = roundMoney(l.sellingPrice)
    if (selling <= 0) return true
    return roundMoney(l.costPrice) > 0
  })
}

/** Inverse of isOrderSheetComplete — used for dashboard pending counts. */
export function isPendingOrderSheet(
  lines: { costPrice: number; sellingPrice: number }[] | null | undefined,
): boolean {
  return !isOrderSheetComplete(lines)
}

/** Map retail PriceBreakdown → finance sheet kinds (quoted / selling guidance).
 *  Value Addition (goldVA + stoneVA) → WASTAGE_CHARGES. */
export function quotedAmountsFromBreakdown(
  b: {
    goldValue: number
    goldVA: number
    making: number
    stoneValue: number
    stoneVA: number
    miscCharges: number
    gst: number
  },
  quantity = 1,
): Record<FinanceLineKind, number> {
  const q = Math.max(1, quantity)
  return {
    GOLD: roundMoney(b.goldValue * q),
    DIAMONDS: roundMoney(b.stoneValue * q),
    STONES: 0,
    MAKING_CHARGES: roundMoney(b.making * q),
    WASTAGE_CHARGES: roundMoney((b.goldVA + b.stoneVA) * q),
    DELIVERY: roundMoney(b.miscCharges * q),
    GST: roundMoney(b.gst * q),
  }
}

export type OrderItemQuote = {
  orderItemId: string
  productName: string
  quantity: number
  withExchange: boolean
  /** Quoted column — live catalogue except GOLD from checkout snapshot when present. */
  quotedTotal: number
  /** Snapshot unit price stored on the order line × qty. */
  snapshotTotal: number
  byKind: Record<FinanceLineKind, number>
  /**
   * Prefill for Selling column — full checkout breakdown mapped to finance kinds.
   * Falls back to byKind when no snapshot exists.
   */
  sellingByKind: Record<FinanceLineKind, number>
}

export function sumQuotedByKind(items: OrderItemQuote[]): Record<FinanceLineKind, number> {
  const out = Object.fromEntries(FINANCE_LINE_KINDS.map((k) => [k, 0])) as Record<FinanceLineKind, number>
  for (const item of items) {
    for (const kind of FINANCE_LINE_KINDS) {
      out[kind] = roundMoney(out[kind] + (item.byKind[kind] ?? 0))
    }
  }
  return out
}

export function sumSellingByKind(items: OrderItemQuote[]): Record<FinanceLineKind, number> {
  const out = Object.fromEntries(FINANCE_LINE_KINDS.map((k) => [k, 0])) as Record<FinanceLineKind, number>
  for (const item of items) {
    const src = item.sellingByKind ?? item.byKind
    for (const kind of FINANCE_LINE_KINDS) {
      out[kind] = roundMoney(out[kind] + (src[kind] ?? 0))
    }
  }
  return out
}

export function orderProfit(sellingPrice: number, cost: number): number {
  return roundMoney(sellingPrice - cost)
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** Short display id — same as Admin Orders “Order” column: last 8 of the cuid. */
export function shortFinanceId(id: string, len = 8): string {
  if (!id) return '—'
  return id.length <= len ? id : id.slice(-len)
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

/** Calendar quarter 1–4 → months [1–3], [4–6], [7–9], [10–12]. */
export function istQuarterUtcRange(year: number, quarter: number): { start: Date; end: Date } {
  const q = Math.min(4, Math.max(1, Math.floor(quarter)))
  const startMonth = (q - 1) * 3 + 1
  const endMonth = startMonth + 3 // exclusive month index via next quarter start
  const start = istMonthUtcRange(year, startMonth).start
  const end =
    endMonth > 12
      ? istMonthUtcRange(year + 1, 1).start
      : istMonthUtcRange(year, endMonth).start
  return { start, end }
}

export function istQuarter(d: Date): { year: number; quarter: number } {
  const { year, month } = istYearMonth(d)
  return { year, quarter: Math.ceil(month / 3) }
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

/** UTC instant for the start of an IST calendar day `daysAgo` days before today (0 = today). */
export function istStartOfDayUtc(daysAgo = 0, now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS)
  const y = ist.getUTCFullYear()
  const m = ist.getUTCMonth()
  const day = ist.getUTCDate() - daysAgo
  return new Date(Date.UTC(y, m, day) - IST_OFFSET_MS)
}

export type ExpenseRow = {
  date: Date
  amount: number
  paidThrough: FinancePaidThrough
  accountId: string | null
}

export type OrderSheetRow = {
  orderId?: string
  orderLabel?: string
  orderCreatedAt: Date
  cost: number
  sellingPrice: number
  paidToAccountId: string
}

export type AccountRef = {
  id: string
  name: string
  type: FinanceAccountType
}

export type AccountTotals = {
  accountId: string
  accountName: string
  contribution: number
  receiptsHeld: number
}

export type AccountFlowTotals = {
  accountId: string
  accountName: string
  inflow: number
  outflow: number
  net: number
}

export type FinanceSummary = {
  income: number
  orderCost: number
  generalExpenses: number
  profit: number
  byAccount: AccountTotals[]
}

export type TxFlowRow = {
  date: Date
  direction: 'INFLOW' | 'OUTFLOW' | 'TRANSFER'
  amount: number
  paidThroughAccountId: string
  /** Destination wallet when direction is TRANSFER. */
  transferToAccountId?: string | null
}

export type DashboardKpis = {
  income: number
  purchasePrice: number
  generalExpenses: number
  profit: number
}

export type TxExpenseRow = {
  date: Date
  direction: 'INFLOW' | 'OUTFLOW' | 'TRANSFER'
  amount: number
  /** True when linked to one or more store orders. */
  relatedToOrder: boolean
}

export type OrderInflowTxRow = {
  date: Date
  amount: number
  /** Orders linked on this INFLOW transaction (legacy join / fallback). */
  orderIds: string[]
  /**
   * Exact FinanceAllocation amounts per order. When present, used instead of
   * splitting `amount` evenly across `orderIds`.
   */
  allocations?: { orderId: string; amount: number }[]
}

export type SheetInflowMismatch = {
  orderId: string
  orderLabel: string
  sheetSelling: number
  inflowTotal: number
}

/**
 * Dashboard cards:
 * income = Σ order-sheet selling prices
 * purchasePrice = Σ order-sheet cost prices
 * generalExpenses = Σ OUTFLOW transactions with no related order
 * profit = income − purchasePrice − generalExpenses
 */
export function summarizeDashboardKpis(
  sheets: OrderSheetRow[],
  transactions: TxExpenseRow[],
  range?: { start: Date; end: Date },
): DashboardKpis {
  const inRange = (d: Date) => !range || (d >= range.start && d < range.end)
  const income = roundMoney(
    sheets.filter((s) => inRange(s.orderCreatedAt)).reduce((s, r) => s + r.sellingPrice, 0),
  )
  const purchasePrice = roundMoney(
    sheets.filter((s) => inRange(s.orderCreatedAt)).reduce((s, r) => s + r.cost, 0),
  )
  const generalExpenses = roundMoney(
    transactions
      .filter((t) => inRange(t.date) && !t.relatedToOrder && t.direction === 'OUTFLOW')
      .reduce((s, t) => s + t.amount, 0),
  )
  return {
    income,
    purchasePrice,
    generalExpenses,
    profit: roundMoney(income - purchasePrice - generalExpenses),
  }
}

/**
 * Orders whose sheet selling total ≠ sum of allocated INFLOW amounts.
 * Prefers FinanceAllocation rows; falls back to even-split of linked join amounts
 * for legacy cashbook rows without allocations.
 */
export function findSheetInflowMismatches(
  sheets: OrderSheetRow[],
  inflows: OrderInflowTxRow[],
  range?: { start: Date; end: Date },
): SheetInflowMismatch[] {
  const inRange = (d: Date) => !range || (d >= range.start && d < range.end)
  const inflowByOrder = new Map<string, number>()

  for (const t of inflows) {
    if (!inRange(t.date)) continue
    if (t.allocations && t.allocations.length > 0) {
      for (const a of t.allocations) {
        if (!a.orderId) continue
        inflowByOrder.set(a.orderId, (inflowByOrder.get(a.orderId) ?? 0) + a.amount)
      }
      continue
    }
    if (t.orderIds.length === 0) continue
    const share = t.amount / t.orderIds.length
    for (const orderId of t.orderIds) {
      inflowByOrder.set(orderId, (inflowByOrder.get(orderId) ?? 0) + share)
    }
  }

  const out: SheetInflowMismatch[] = []
  for (const s of sheets) {
    if (!s.orderId || !inRange(s.orderCreatedAt)) continue
    const sheetSelling = roundMoney(s.sellingPrice)
    const inflowTotal = roundMoney(inflowByOrder.get(s.orderId) ?? 0)
    if (sheetSelling === inflowTotal) continue
    out.push({
      orderId: s.orderId,
      orderLabel: s.orderLabel || s.orderId,
      sheetSelling,
      inflowTotal,
    })
  }
  return out
}

/** Per-account inflow / outflow / net from ledger transactions (by wallet used).
 * Transfers: From (paidThrough) counts as outflow; To (transferTo) counts as inflow. */
export function summarizeTransactionFlows(
  transactions: TxFlowRow[],
  accounts: AccountRef[],
  range?: { start: Date; end: Date },
): AccountFlowTotals[] {
  const inRange = (d: Date) => !range || (d >= range.start && d < range.end)
  const txs = transactions.filter((t) => inRange(t.date))

  return accounts.map((account) => {
    const inflow = roundMoney(
      txs
        .filter(
          (t) =>
            (t.direction === 'INFLOW' && t.paidThroughAccountId === account.id) ||
            (t.direction === 'TRANSFER' && t.transferToAccountId === account.id),
        )
        .reduce((s, t) => s + t.amount, 0),
    )
    const outflow = roundMoney(
      txs
        .filter(
          (t) =>
            (t.direction === 'OUTFLOW' && t.paidThroughAccountId === account.id) ||
            (t.direction === 'TRANSFER' && t.paidThroughAccountId === account.id),
        )
        .reduce((s, t) => s + t.amount, 0),
    )
    return {
      accountId: account.id,
      accountName: account.name,
      inflow,
      outflow,
      net: roundMoney(inflow - outflow),
    }
  })
}

export function summarizeFinance(
  expenses: ExpenseRow[],
  sheets: OrderSheetRow[],
  accounts: AccountRef[],
  range?: { start: Date; end: Date },
): FinanceSummary {
  const inRange = (d: Date) => !range || (d >= range.start && d < range.end)
  const ex = expenses.filter((e) => inRange(e.date))
  const sh = sheets.filter((s) => inRange(s.orderCreatedAt))

  const generalExpenses = roundMoney(ex.reduce((s, e) => s + e.amount, 0))
  const income = roundMoney(sh.reduce((s, r) => s + r.sellingPrice, 0))
  const cp = roundMoney(sh.reduce((s, r) => s + r.cost, 0))
  const orderProfitSum = roundMoney(sh.reduce((s, r) => s + orderProfit(r.sellingPrice, r.cost), 0))

  const partners = accounts.filter((a) => a.type === 'PARTNER')
  const byAccount: AccountTotals[] = partners.map((account) => ({
    accountId: account.id,
    accountName: account.name,
    contribution: roundMoney(
      ex
        .filter((e) => e.paidThrough === 'PERSONAL_FUNDS' && e.accountId === account.id)
        .reduce((s, e) => s + e.amount, 0),
    ),
    receiptsHeld: roundMoney(
      sh.filter((r) => r.paidToAccountId === account.id).reduce((s, r) => s + r.sellingPrice, 0),
    ),
  }))

  return {
    income,
    orderCost: cp,
    generalExpenses,
    profit: roundMoney(orderProfitSum - generalExpenses),
    byAccount,
  }
}

export type ReportTxRow = {
  date: Date
  direction: FinanceTransactionDirection
  amount: number
  categoryId: string | null
  categoryName: string | null
}

export type CategorySlice = {
  categoryId: string | null
  categoryName: string
  amount: number
  pct: number
}

export type MonthBucket = {
  year: number
  month: number
  label: string
  inflow: number
  outflow: number
  net: number
}

export type TransactionReport = {
  inflow: number
  outflow: number
  net: number
  inflowByCategory: CategorySlice[]
  outflowByCategory: CategorySlice[]
  byMonth: MonthBucket[]
}

function byCategory(
  rows: ReportTxRow[],
  direction: 'INFLOW' | 'OUTFLOW',
): CategorySlice[] {
  const map = new Map<string, { categoryId: string | null; categoryName: string; amount: number }>()
  for (const r of rows) {
    if (r.direction !== direction) continue
    const key = r.categoryId ?? '__uncategorized__'
    const cur = map.get(key) ?? {
      categoryId: r.categoryId,
      categoryName: r.categoryName?.trim() || 'Uncategorized',
      amount: 0,
    }
    cur.amount += r.amount
    map.set(key, cur)
  }
  const total = [...map.values()].reduce((s, x) => s + x.amount, 0)
  return [...map.values()]
    .map((x) => ({
      categoryId: x.categoryId,
      categoryName: x.categoryName,
      amount: roundMoney(x.amount),
      pct: total > 0 ? roundMoney((x.amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Cashbook reports: totals, category pies, monthly series. */
export function summarizeTransactionReport(
  transactions: ReportTxRow[],
  range?: { start: Date; end: Date },
): TransactionReport {
  const inRange = (d: Date) => !range || (d >= range.start && d < range.end)
  const txs = transactions.filter((t) => inRange(t.date))
  const inflow = roundMoney(txs.filter((t) => t.direction === 'INFLOW').reduce((s, t) => s + t.amount, 0))
  const outflow = roundMoney(txs.filter((t) => t.direction === 'OUTFLOW').reduce((s, t) => s + t.amount, 0))

  const monthMap = new Map<string, MonthBucket>()
  for (const t of txs) {
    const { year, month } = istYearMonth(t.date)
    const key = `${year}-${month}`
    const cur =
      monthMap.get(key) ??
      ({
        year,
        month,
        label: `${MONTH_LABELS[month - 1]} ${year}`,
        inflow: 0,
        outflow: 0,
        net: 0,
      } satisfies MonthBucket)
    if (t.direction === 'INFLOW') cur.inflow += t.amount
    else if (t.direction === 'OUTFLOW') cur.outflow += t.amount
    monthMap.set(key, cur)
  }
  const byMonth = [...monthMap.values()]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((m) => ({
      ...m,
      inflow: roundMoney(m.inflow),
      outflow: roundMoney(m.outflow),
      net: roundMoney(m.inflow - m.outflow),
    }))

  return {
    inflow,
    outflow,
    net: roundMoney(inflow - outflow),
    inflowByCategory: byCategory(txs, 'INFLOW'),
    outflowByCategory: byCategory(txs, 'OUTFLOW'),
    byMonth,
  }
}

export type FinanceReportMode = 'month' | 'quarter' | 'year' | 'all'

export type FinanceReportPeriod = {
  mode: FinanceReportMode
  month: string
  quarter: string
  year: number
}

function readSearchParam(sp: URLSearchParams | Record<string, string | undefined>, key: string): string | undefined {
  if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined
  return sp[key]
}

/** Shared period parsing for Reports page and transaction export. */
export function parseFinanceReportSearchParams(
  sp: URLSearchParams | Record<string, string | undefined>,
): FinanceReportPeriod {
  const nowYm = istYearMonth(new Date())
  const nowQ = istQuarter(new Date())
  const periodAll = readSearchParam(sp, 'period') === 'all'
  const quarterRaw = readSearchParam(sp, 'quarter')
  const quarterMatch = quarterRaw?.match(/^(\d{4})-([1-4])$/)
  const yearRaw = readSearchParam(sp, 'year')
  const yearOnly = !quarterMatch && yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null
  const monthRaw = readSearchParam(sp, 'month')
  const monthValue =
    monthRaw && /^\d{4}-\d{2}$/.test(monthRaw)
      ? monthRaw
      : `${nowYm.year}-${String(nowYm.month).padStart(2, '0')}`
  const quarterValue = quarterMatch ? `${quarterMatch[1]}-${quarterMatch[2]}` : `${nowQ.year}-${nowQ.quarter}`

  const mode: FinanceReportMode = periodAll
    ? 'all'
    : quarterMatch
      ? 'quarter'
      : yearOnly
        ? 'year'
        : 'month'

  return {
    mode,
    month: monthValue,
    quarter: quarterValue,
    year: yearOnly ?? nowYm.year,
  }
}

export function financeReportDateRange(period: FinanceReportPeriod): {
  start?: Date
  end?: Date
  fileLabel: string
} {
  if (period.mode === 'all') return { fileLabel: 'all-time' }
  if (period.mode === 'year') {
    const range = istMonthUtcRange(period.year, 1)
    const end = istMonthUtcRange(period.year, 12).end
    return { start: range.start, end, fileLabel: String(period.year) }
  }
  if (period.mode === 'quarter') {
    const [y, q] = period.quarter.split('-').map(Number)
    const { start, end } = istQuarterUtcRange(y, q)
    return { start, end, fileLabel: `${y}-Q${q}` }
  }
  const [y, m] = period.month.split('-').map(Number)
  const { start, end } = istMonthUtcRange(y, m)
  return { start, end, fileLabel: period.month }
}

