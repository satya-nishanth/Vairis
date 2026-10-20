import type { FinanceAccountType, FinanceLineKind, FinancePaidThrough } from '@prisma/client'
import { splitGemValues } from '@/lib/pricing'
import {
  resolveMiscChargeLines,
  sumMiscChargeLines,
  type MiscChargeLine,
} from '@/lib/misc-charges'

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

export const FINANCE_LINE_KINDS = [
  'GOLD',
  'DIAMONDS',
  'STONES',
  'MAKING_CHARGES',
  'WASTAGE_CHARGES',
  'CERTIFICATION',
  'PACKAGING',
  'DELIVERY',
  'MISC',
  'GST',
  'DISCOUNT',
] as const

export const LINE_KIND_LABEL: Record<FinanceLineKind, string> = {
  DELIVERY: 'Delivery',
  GST: 'GST',
  GOLD: 'Gold',
  STONES: 'Stones',
  DIAMONDS: 'Diamonds',
  MAKING_CHARGES: 'Making charges',
  WASTAGE_CHARGES: 'Wastage',
  CERTIFICATION: 'Certification',
  PACKAGING: 'Packaging',
  MISC: 'Misc',
  DISCOUNT: 'Discount',
}

export const ACCOUNT_TYPE_LABEL: Record<FinanceAccountType, string> = {
  PARTNER: 'Partner',
  COMPANY_BANK: 'Company bank',
  CASH: 'Cash',
  VENDOR: 'Vendor',
  VAULT: 'Vault',
  OTHER: 'Other',
}

export function isVaultAccountType(type: string | null | undefined): boolean {
  return type === 'VAULT'
}

/** Format gram weights for Vault By Account rows. */
export function formatGrams(n: number): string {
  return `${n.toLocaleString('en-IN', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  })} g`
}

/** 24K ₹/g from stored 18K rate (MetalpriceAPI sync stores 18K = 24K × 18/24). */
export function goldRate24kFrom18k(rate18kPerGram: number): number {
  return roundMoney(Number(rate18kPerGram) * (24 / 18))
}

/**
 * Live ₹ value of vault holdings for the inventory purchase-price KPI.
 * Each holding: max(0, netGrams) × rate24k × (purityK / 24). Default purity 24K.
 */
export function vaultHoldingsLiveValue(
  holdings: { netGrams: number; purityK?: number | null }[],
  rate24kPerGram: number,
): number {
  if (!(rate24kPerGram > 0)) return 0
  let total = 0
  for (const h of holdings) {
    const grams = h.netGrams > 0 ? h.netGrams : 0
    if (grams <= 0) continue
    const purity = Number(h.purityK)
    const k = Number.isFinite(purity) && purity > 0 ? purity : 24
    total += grams * rate24kPerGram * (k / 24)
  }
  return roundMoney(total)
}

/** Effective ₹/g for a vault purity given live 24K rate. */
export function vaultRatePerGram(rate24kPerGram: number, purityK: number | null | undefined): number {
  if (!(rate24kPerGram > 0)) return 0
  const k = Number(purityK)
  const purity = Number.isFinite(k) && k > 0 ? k : 24
  return roundMoney(rate24kPerGram * (purity / 24))
}

export type VendorOutflowSource = 'ORDER_SHEETS' | 'TRANSACTIONS' | 'BOTH'

export const VENDOR_OUTFLOW_SOURCE_LABEL: Record<VendorOutflowSource, string> = {
  ORDER_SHEETS: 'Order sheets (purchase price)',
  TRANSACTIONS: 'Transactions (cashbook outflows)',
  BOTH: 'Both order sheets and transactions',
}

export const VENDOR_OUTFLOW_SOURCE_TIP =
  'Order sheets: outflow is purchase (CP) on order sheets attributed to this vendor. ' +
  'Transactions: outflow is OUTFLOW entries in the cashbook paid through this account. ' +
  'Both: sums order-sheet CP and cashbook outflows. ' +
  'Vendors set to transactions only do not appear in the order-sheet “Purchase from” list.'

/** Vendors that can be selected as purchase-from on order sheets. */
export function vendorAppearsOnOrderSheets(source: VendorOutflowSource | null | undefined) {
  const s = source ?? 'ORDER_SHEETS'
  return s === 'ORDER_SHEETS' || s === 'BOTH'
}

/** Dashboard tip for a vendor wallet Inflow cell (always cashbook). */
export function vendorWalletInflowTip(_source?: VendorOutflowSource | null) {
  return (
    'Inflow: cashbook INFLOW transactions and transfers into this vendor wallet ' +
    '(paid through / transfer To).'
  )
}

/** Dashboard tip for a vendor wallet Outflow cell — follows account outflow setting. */
export function vendorWalletOutflowTip(source?: VendorOutflowSource | null) {
  const s = source ?? 'ORDER_SHEETS'
  if (s === 'TRANSACTIONS') {
    return (
      'Outflow: cashbook OUTFLOW transactions and transfers from this wallet only. ' +
      'Order-sheet purchase price is not included (Transactions).'
    )
  }
  if (s === 'BOTH') {
    return (
      'Outflow: order-sheet purchase (CP) attributed to this vendor plus cashbook OUTFLOW / ' +
      'transfers from this wallet (Both).'
    )
  }
  return (
    'Outflow: order-sheet purchase (CP) attributed to this vendor only. ' +
    'Cashbook OUTFLOWs on this wallet are not included (Order sheets).'
  )
}

/** Category config — inflow/outflow only (TRANSFER is for transactions, not categories). */
export type FinanceCategoryDirection = 'INFLOW' | 'OUTFLOW'

export type FinanceTransactionDirection = 'INFLOW' | 'OUTFLOW' | 'TRANSFER'

export function toFinanceCategoryDirection(value: string): FinanceCategoryDirection {
  return value === 'INFLOW' ? 'INFLOW' : 'OUTFLOW'
}

export function toFinanceTransactionDirection(value: string): FinanceTransactionDirection {
  if (value === 'INFLOW' || value === 'TRANSFER') return value
  return 'OUTFLOW'
}

export type FinanceLineInput = {
  kind: FinanceLineKind
  costPrice: number
  sellingPrice: number
}

export function sheetTotals(
  lines: FinanceLineInput[],
  opts?: { roundOffEnabled?: boolean },
): {
  cost: number
  /** Effective selling (rounded to nearest ₹ when round-off is on). */
  selling: number
  sellingRaw: number
  /** selling − sellingRaw when round-off is on; else 0. */
  roundOff: number
  profit: number
  roundOffEnabled: boolean
} {
  const cost = roundMoney(lines.reduce((s, l) => s + l.costPrice, 0))
  // DISCOUNT is stored as a positive amount and subtracted from selling.
  const sellingRaw = roundMoney(
    lines.reduce((s, l) => {
      const n = Number(l.sellingPrice) || 0
      return l.kind === 'DISCOUNT' ? s - n : s + n
    }, 0),
  )
  const roundOffEnabled = Boolean(opts?.roundOffEnabled)
  if (!roundOffEnabled) {
    return {
      cost,
      selling: sellingRaw,
      sellingRaw,
      roundOff: 0,
      profit: orderProfit(sellingRaw, cost),
      roundOffEnabled: false,
    }
  }
  const selling = Math.round(sellingRaw)
  const roundOff = roundMoney(selling - sellingRaw)
  return {
    cost,
    selling,
    sellingRaw,
    roundOff,
    profit: orderProfit(selling, cost),
    roundOffEnabled: true,
  }
}

/**
 * Order sheet is complete when every line with a selling price has a
 * non-zero purchase/cost price. Discount never needs a purchase price.
 * No sheet → not complete.
 */
export function isOrderSheetComplete(
  lines: { costPrice: number; sellingPrice: number; kind?: string }[] | null | undefined,
): boolean {
  if (!lines) return false
  return lines.every((l) => {
    if (l.kind === 'DISCOUNT') return true
    const selling = roundMoney(l.sellingPrice)
    if (selling <= 0) return true
    return roundMoney(l.costPrice) > 0
  })
}

/** Inverse of isOrderSheetComplete — used for dashboard pending counts. */
export function isPendingOrderSheet(
  lines: { costPrice: number; sellingPrice: number; kind?: string }[] | null | undefined,
): boolean {
  return !isOrderSheetComplete(lines)
}

/** Map retail PriceBreakdown → finance sheet kinds (quoted / selling guidance).
 *  Value Addition (goldVA + stoneVA) → WASTAGE_CHARGES.
 *  All misc lines collapse into MISC. Discount is positive (subtracted in sheetTotals).
 *  Diamonds / Stones split via {@link splitGemValues}. */
export function quotedAmountsFromBreakdown(
  b: {
    goldValue: number
    goldVA: number
    making: number
    stoneValue: number
    stoneVA: number
    miscCharges: number
    gst: number
    diamondValue?: number | null
    otherStoneValue?: number | null
    stoneLines?: { typeLabel: string; value: number }[] | null
    certificationCharges?: number | null
    packagingCharges?: number | null
    deliveryCharges?: number | null
    miscLines?: MiscChargeLine[] | null
    autoDiscount?: number | null
    couponDiscount?: number | null
  },
  quantity = 1,
): Record<FinanceLineKind, number> {
  const q = Math.max(1, quantity)
  const gems = splitGemValues(b)
  const misc = sumMiscChargeLines(
    resolveMiscChargeLines(b.miscLines, Number(b.miscCharges) || 0),
  )
  const discount =
    Math.max(0, Number(b.autoDiscount) || 0) + Math.max(0, Number(b.couponDiscount) || 0)
  return {
    GOLD: roundMoney(b.goldValue * q),
    DIAMONDS: roundMoney(gems.diamonds * q),
    STONES: roundMoney(gems.stones * q),
    MAKING_CHARGES: roundMoney(b.making * q),
    WASTAGE_CHARGES: roundMoney((b.goldVA + b.stoneVA) * q),
    CERTIFICATION: roundMoney((Number(b.certificationCharges) || 0) * q),
    PACKAGING: roundMoney((Number(b.packagingCharges) || 0) * q),
    DELIVERY: roundMoney((Number(b.deliveryCharges) || 0) * q),
    MISC: roundMoney(misc * q),
    GST: roundMoney(b.gst * q),
    DISCOUNT: roundMoney(discount * q),
  }
}

/** Net quoted / selling Σ — discount reduces the total. */
export function sumFinanceKindsNet(byKind: Record<FinanceLineKind, number>): number {
  return roundMoney(
    FINANCE_LINE_KINDS.reduce((s, k) => {
      const n = byKind[k] ?? 0
      return k === 'DISCOUNT' ? s - n : s + n
    }, 0),
  )
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
  purchaseFromAccountId?: string | null
}

export type AccountRef = {
  id: string
  name: string
  type: FinanceAccountType
  isVendorWallet?: boolean
  vendorOutflowSource?: VendorOutflowSource | null
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
  /** Σ INFLOW transactions (cash received). */
  income: number
  /** Σ order-sheet selling prices. */
  selling: number
  /** Σ order-sheet cost / purchase prices. */
  purchasePrice: number
  /** selling − purchase (order-sheet margin). */
  orderProfit: number
  /** orderProfit as % of selling; null when selling is 0. */
  orderProfitPct: number | null
  /** Order sheets in range. */
  sheetCount: number
  /** Σ OUTFLOW transactions excluding Inventory purchases category. */
  generalExpenses: number
  /** selling − purchase − generalExpenses (legacy net). */
  profit: number
}

/** Canonical category name excluded from dashboard general expenses. */
export const INVENTORY_PURCHASES_CATEGORY = 'Inventory purchases'

/** True for Inventory purchase(s) category — tolerant of singular/plural and common typos. */
export function isInventoryPurchasesCategory(name: string | null | undefined): boolean {
  const n = (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!n) return false
  if (n === 'inventory purchases' || n === 'inventory purchase') return true
  const compact = n.replace(/[^a-z]/g, '')
  // "inventorypurchases", "inventorypurchase", typo "inventorypurcahses"
  return (
    compact.includes('inventory') &&
    (compact.includes('purchas') || compact.includes('purcahs'))
  )
}

export type TxExpenseRow = {
  date: Date
  direction: 'INFLOW' | 'OUTFLOW' | 'TRANSFER'
  amount: number
  /** True when linked to one or more store orders / bills. */
  relatedToOrder: boolean
  categoryId?: string | null
  /** Finance category name; used to exclude Inventory purchases from opex. */
  categoryName?: string | null
  /** True when any allocation points at a purchase bill (goods / inventory buy). */
  hasPurchaseBillAllocation?: boolean
  /** True when txn is linked to inventory item(s) or unlinked inventory labels. */
  hasInventoryLink?: boolean
}

export type DashboardKpiCategoryConfig = {
  /** Empty = all INFLOW txs. Non-empty = only these category ids. */
  cashInflowCategoryIds: string[]
  /** Empty = OUTFLOW minus inventory heuristics. Non-empty = only these category ids. */
  generalExpenseCategoryIds: string[]
}

export type OrderInflowTxRow = {
  date: Date
  amount: number
  /** Orders linked on this receipt transaction (legacy join / fallback). */
  orderIds: string[]
  /**
   * Exact FinanceAllocation amounts per order. When present, used instead of
   * splitting `amount` evenly across `orderIds`.
   */
  allocations?: { orderId: string; amount: number }[]
  /** Defaults to INFLOW when omitted (legacy callers / tests). */
  direction?: 'INFLOW' | 'TRANSFER'
  /** True when TRANSFER destination is COMPANY_BANK (Vairis bank). */
  transferToCompanyBank?: boolean
}

export type SheetInflowMismatch = {
  orderId: string
  orderLabel: string
  sheetSelling: number
  inflowTotal: number
}

/** One allocated (or even-split) receipt leg toward an order. */
export type OrderReceiptCollectedLeg = {
  orderId: string
  amount: number
  direction: 'INFLOW' | 'TRANSFER'
  /** TRANSFER whose destination is COMPANY_BANK (Vairis bank). */
  transferToCompanyBank?: boolean
}

/**
 * Sheet SP vs checkout / allocated receipts — ignore ≤ ₹1 round-off
 * (sheet line decimals vs whole-rupee checkout / bank amounts).
 */
export const SHEET_RECONCILE_TOLERANCE_RUPEES = 1

/** Customer receipts: cash INFLOW or TRANSFER allocated / linked to orders. */
export function isOrderReceiptDirection(direction: string): boolean {
  return direction === 'INFLOW' || direction === 'TRANSFER'
}

/**
 * Collected toward orders from receipt legs.
 * Counts INFLOW + TRANSFER. When any TRANSFER→COMPANY_BANK exists for an order,
 * INFLOW for that order is ignored so settle does not double-count.
 */
export function sumCollectedByOrderId(
  legs: OrderReceiptCollectedLeg[],
): Map<string, number> {
  const hasCompanyBankTransfer = new Set<string>()
  for (const leg of legs) {
    if (leg.direction === 'TRANSFER' && leg.transferToCompanyBank) {
      hasCompanyBankTransfer.add(leg.orderId)
    }
  }
  const map = new Map<string, number>()
  for (const leg of legs) {
    if (leg.direction !== 'INFLOW' && leg.direction !== 'TRANSFER') continue
    if (leg.direction === 'INFLOW' && hasCompanyBankTransfer.has(leg.orderId)) continue
    map.set(leg.orderId, roundMoney((map.get(leg.orderId) ?? 0) + Number(leg.amount)))
  }
  return map
}

function receiptLegsFromInflowRows(
  inflows: OrderInflowTxRow[],
  inRange: (d: Date) => boolean,
): OrderReceiptCollectedLeg[] {
  const legs: OrderReceiptCollectedLeg[] = []
  for (const t of inflows) {
    if (!inRange(t.date)) continue
    const direction: 'INFLOW' | 'TRANSFER' = t.direction ?? 'INFLOW'
    const transferToCompanyBank = Boolean(t.transferToCompanyBank)
    if (t.allocations && t.allocations.length > 0) {
      for (const a of t.allocations) {
        if (!a.orderId) continue
        legs.push({
          orderId: a.orderId,
          amount: a.amount,
          direction,
          transferToCompanyBank,
        })
      }
      continue
    }
    if (t.orderIds.length === 0) continue
    const share = t.amount / t.orderIds.length
    for (const orderId of t.orderIds) {
      legs.push({ orderId, amount: share, direction, transferToCompanyBank })
    }
  }
  return legs
}

/**
 * Dashboard cards:
 * income = Σ INFLOW (optionally filtered by cashInflowCategoryIds)
 * selling / purchasePrice = Σ order-sheet totals
 * orderProfit = selling − purchase
 * generalExpenses = Σ OUTFLOW (config categories, or legacy excl. inventory purchases)
 * profit = selling − purchase − generalExpenses
 */
export function summarizeDashboardKpis(
  sheets: OrderSheetRow[],
  transactions: TxExpenseRow[],
  range?: { start: Date; end: Date },
  categoryConfig?: DashboardKpiCategoryConfig,
): DashboardKpis {
  const inRange = (d: Date) => !range || (d >= range.start && d < range.end)
  const sheetsInRange = sheets.filter((s) => inRange(s.orderCreatedAt))
  const selling = roundMoney(sheetsInRange.reduce((s, r) => s + r.sellingPrice, 0))
  const purchasePrice = roundMoney(sheetsInRange.reduce((s, r) => s + r.cost, 0))
  const orderProfit = roundMoney(selling - purchasePrice)

  const inflowIds = categoryConfig?.cashInflowCategoryIds ?? []
  const expenseIds = categoryConfig?.generalExpenseCategoryIds ?? []
  const inflowSet = inflowIds.length > 0 ? new Set(inflowIds) : null
  const expenseSet = expenseIds.length > 0 ? new Set(expenseIds) : null

  const income = roundMoney(
    transactions
      .filter((t) => {
        if (!inRange(t.date) || t.direction !== 'INFLOW') return false
        if (!inflowSet) return true
        return Boolean(t.categoryId && inflowSet.has(t.categoryId))
      })
      .reduce((s, t) => s + t.amount, 0),
  )

  const isInventoryPurchaseOutflow = (t: TxExpenseRow) =>
    isInventoryPurchasesCategory(t.categoryName) ||
    Boolean(t.hasPurchaseBillAllocation) ||
    Boolean(t.hasInventoryLink)

  const generalExpenses = roundMoney(
    transactions
      .filter((t) => {
        if (!inRange(t.date) || t.direction !== 'OUTFLOW') return false
        if (expenseSet) return Boolean(t.categoryId && expenseSet.has(t.categoryId))
        return !isInventoryPurchaseOutflow(t)
      })
      .reduce((s, t) => s + t.amount, 0),
  )
  return {
    income,
    selling,
    purchasePrice,
    orderProfit,
    orderProfitPct: selling > 0.0001 ? Math.round((orderProfit / selling) * 1000) / 10 : null,
    sheetCount: sheetsInRange.length,
    generalExpenses,
    profit: roundMoney(orderProfit - generalExpenses),
  }
}

/**
 * Orders whose sheet selling total ≠ collected receipts (INFLOW + TRANSFER;
 * INFLOW ignored when a TRANSFER→COMPANY_BANK exists for the order).
 * Prefers FinanceAllocation rows; falls back to even-split of linked join amounts.
 */
export function findSheetInflowMismatches(
  sheets: OrderSheetRow[],
  inflows: OrderInflowTxRow[],
  range?: { start: Date; end: Date },
): SheetInflowMismatch[] {
  const inRange = (d: Date) => !range || (d >= range.start && d < range.end)
  const inflowByOrder = sumCollectedByOrderId(receiptLegsFromInflowRows(inflows, inRange))

  const out: SheetInflowMismatch[] = []
  for (const s of sheets) {
    if (!s.orderId || !inRange(s.orderCreatedAt)) continue
    const sheetSelling = roundMoney(s.sellingPrice)
    const inflowTotal = roundMoney(inflowByOrder.get(s.orderId) ?? 0)
    // Paisa drift and whole-rupee checkout vs decimal sheet SP — tolerate ≤ ₹1.
    if (Math.abs(sheetSelling - inflowTotal) <= SHEET_RECONCILE_TOLERANCE_RUPEES) continue
    out.push({
      orderId: s.orderId,
      orderLabel: s.orderLabel || s.orderId,
      sheetSelling,
      inflowTotal,
    })
  }
  return out
}

/** Order-sheet purchase attributed to a vendor wallet (dashboard By account outflow). */
export type SheetPurchaseOutflow = {
  date: Date
  accountId: string
  amount: number
}

export function buildSheetPurchaseOutflows(
  sheets: Pick<OrderSheetRow, 'orderCreatedAt' | 'cost' | 'purchaseFromAccountId'>[],
): SheetPurchaseOutflow[] {
  const out: SheetPurchaseOutflow[] = []
  for (const s of sheets) {
    const accountId = s.purchaseFromAccountId?.trim()
    if (!accountId || s.cost <= 0) continue
    out.push({ date: s.orderCreatedAt, accountId, amount: s.cost })
  }
  return out
}

function isVendorAccountRef(account: AccountRef) {
  return account.type === 'VENDOR' || Boolean(account.isVendorWallet)
}

function vendorOutflowFromSheets(account: AccountRef) {
  if (!isVendorAccountRef(account)) return false
  const s = account.vendorOutflowSource ?? 'ORDER_SHEETS'
  return s === 'ORDER_SHEETS' || s === 'BOTH'
}

function vendorOutflowFromTxns(account: AccountRef) {
  if (!isVendorAccountRef(account)) return true
  const s = account.vendorOutflowSource ?? 'ORDER_SHEETS'
  return s === 'TRANSACTIONS' || s === 'BOTH'
}

/** Per-account inflow / outflow / net from ledger transactions (by wallet used).
 * Transfers: From (paidThrough) counts as outflow; To (transferTo) counts as inflow.
 * Vendor wallets: outflow from order-sheet CP, cashbook OUTFLOWs, or both — per vendorOutflowSource. */
export function summarizeTransactionFlows(
  transactions: TxFlowRow[],
  accounts: AccountRef[],
  range?: { start: Date; end: Date },
  sheetPurchaseOutflows: SheetPurchaseOutflow[] = [],
): AccountFlowTotals[] {
  const inRange = (d: Date) => !range || (d >= range.start && d < range.end)
  const txs = transactions.filter((t) => inRange(t.date))
  const sheetOuts = sheetPurchaseOutflows.filter((s) => s.amount > 0 && inRange(s.date))

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
    const txnOutflow = txs
      .filter(
        (t) =>
          (t.direction === 'OUTFLOW' && t.paidThroughAccountId === account.id) ||
          (t.direction === 'TRANSFER' && t.paidThroughAccountId === account.id),
      )
      .reduce((s, t) => s + t.amount, 0)
    const sheetOutflow = sheetOuts
      .filter((s) => s.accountId === account.id)
      .reduce((s, r) => s + r.amount, 0)
    const useSheets = vendorOutflowFromSheets(account)
    const useTxns = vendorOutflowFromTxns(account)
    const outflow = roundMoney((useTxns ? txnOutflow : 0) + (useSheets ? sheetOutflow : 0))
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

