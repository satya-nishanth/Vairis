import {
  findSheetInflowMismatches,
  roundMoney,
  shortFinanceId,
  summarizeDashboardKpis,
  summarizeTransactionFlows,
  type AccountFlowTotals,
  type AccountRef,
  type DashboardKpis,
  type OrderInflowTxRow,
  type OrderSheetRow,
  type SheetInflowMismatch,
  type TxExpenseRow,
  type TxFlowRow,
} from '@/lib/finance'
import { effectiveInventoryHeaderPrice } from '@/lib/inventory-pricing'
import { inventoryDisplayName } from '@/lib/inventory'

/** Non-order OUTFLOWs at or above this amount surface as info exceptions. */
export const LARGE_OUTFLOW_THRESHOLD = 100_000

export type CompanyAuditStockRow = {
  id: string
  label: string
  qtyOnHand: number
  purchasePrice: number | null
  potentialPrice: number | null
  variantId: string | null
}

export type CompanyAuditSaleRow = {
  id: string
  itemId: string
  itemLabel: string
  qty: number
  orderId: string | null
  unlinkedOrderLabel: string | null
  soldAt: Date
}

export type CompanyAuditInflowRow = {
  id: string
  date: Date
  amount: number
  orderIds: string[]
  unlinkedOrderLabels: string[]
}

export type CompanyAuditOutflowRow = {
  id: string
  date: Date
  amount: number
  relatedToOrder: boolean
  description: string | null
}

export type AuditExceptionSeverity = 'red' | 'amber' | 'info'

export type AuditException = {
  id: string
  severity: AuditExceptionSeverity
  kind: string
  title: string
  detail: string
  amount: number | null
  href: string
}

export type CompanyAuditStockSummary = {
  stockAtCost: number
  stockAtPotential: number
  unrealizedMargin: number
  inStockLines: number
  valuedLines: number
}

export type CompanyAuditBooks = {
  cash: { inflow: number; outflow: number; net: number }
  orders: { selling: number; cost: number; margin: number }
  stock: CompanyAuditStockSummary
}

export type CompanyAuditResult = {
  kpis: {
    cashOnHand: number
    stockAtCost: number
    stockAtPotential: number
    realizedProfit: number
    unrealizedMargin: number
  }
  bridge: {
    income: number
    cogs: number
    gross: number
    opex: number
    profit: number
  }
  realized: DashboardKpis
  cashByAccount: AccountFlowTotals[]
  books: CompanyAuditBooks
  exceptions: AuditException[]
  exceptionCounts: { red: number; amber: number; info: number; total: number }
}

function severityRank(s: AuditExceptionSeverity): number {
  return s === 'red' ? 0 : s === 'amber' ? 1 : 2
}

export function summarizeInventoryStock(
  rows: CompanyAuditStockRow[],
  liveByVariantId: Record<string, number>,
): CompanyAuditStockSummary {
  let stockAtCost = 0
  let stockAtPotential = 0
  let inStockLines = 0
  let valuedLines = 0

  for (const r of rows) {
    if (r.qtyOnHand <= 0) continue
    inStockLines += 1
    if (r.purchasePrice != null) {
      stockAtCost += r.qtyOnHand * r.purchasePrice
    }
    const header = effectiveInventoryHeaderPrice(
      r.potentialPrice,
      r.purchasePrice,
      r.variantId,
      liveByVariantId,
    )
    if (header != null) {
      valuedLines += 1
      stockAtPotential += r.qtyOnHand * header
    }
  }

  stockAtCost = roundMoney(stockAtCost)
  stockAtPotential = roundMoney(stockAtPotential)
  return {
    stockAtCost,
    stockAtPotential,
    unrealizedMargin: roundMoney(stockAtPotential - stockAtCost),
    inStockLines,
    valuedLines,
  }
}

export function buildCompanyAuditExceptions(input: {
  mismatches: SheetInflowMismatch[]
  inflows: CompanyAuditInflowRow[]
  outflows: CompanyAuditOutflowRow[]
  stockRows: CompanyAuditStockRow[]
  sales: CompanyAuditSaleRow[]
  liveByVariantId: Record<string, number>
  range?: { start: Date; end: Date }
  largeOutflowThreshold?: number
}): AuditException[] {
  const threshold = input.largeOutflowThreshold ?? LARGE_OUTFLOW_THRESHOLD
  const inRange = (d: Date) => !input.range || (d >= input.range.start && d < input.range.end)
  const out: AuditException[] = []

  for (const m of input.mismatches) {
    const delta = roundMoney(m.sheetSelling - m.inflowTotal)
    out.push({
      id: `sheet-inflow-${m.orderId}`,
      severity: 'red',
      kind: 'sheet_inflow_mismatch',
      title: `Sheet ≠ inflow · ${shortFinanceId(m.orderId)}`,
      detail: `Sheet SP ₹${m.sheetSelling.toLocaleString('en-IN')} · Inflows ₹${m.inflowTotal.toLocaleString('en-IN')}`,
      amount: Math.abs(delta),
      href: `/admin/finance/orders?orderId=${encodeURIComponent(m.orderId)}`,
    })
  }

  for (const t of input.inflows) {
    if (!inRange(t.date)) continue
    if (t.orderIds.length > 0 || t.unlinkedOrderLabels.length > 0) continue
    out.push({
      id: `inflow-orphan-${t.id}`,
      severity: 'amber',
      kind: 'inflow_no_order',
      title: 'Inflow with no order',
      detail: `${t.date.toISOString().slice(0, 10)} · link an order or add a free-text ref`,
      amount: t.amount,
      href: `/admin/finance/transactions`,
    })
  }

  for (const r of input.stockRows) {
    if (r.qtyOnHand <= 0) continue
    const header = effectiveInventoryHeaderPrice(
      r.potentialPrice,
      r.purchasePrice,
      r.variantId,
      input.liveByVariantId,
    )
    if (header == null) {
      out.push({
        id: `stock-valuation-${r.id}`,
        severity: 'amber',
        kind: 'stock_missing_valuation',
        title: `Stock missing valuation · ${r.label}`,
        detail: 'No potential, live catalogue, or purchase price',
        amount: null,
        href: `/admin/inventory/${r.id}`,
      })
    }
  }

  for (const t of input.outflows) {
    if (!inRange(t.date) || t.relatedToOrder || t.amount < threshold) continue
    out.push({
      id: `large-outflow-${t.id}`,
      severity: 'info',
      kind: 'large_non_order_outflow',
      title: 'Large non-order outflow',
      detail: `${t.date.toISOString().slice(0, 10)}${t.description ? ` · ${t.description}` : ''} — confirm opex vs stock buy`,
      amount: t.amount,
      href: `/admin/finance/transactions`,
    })
  }

  for (const s of input.sales) {
    if (s.orderId || (s.unlinkedOrderLabel && s.unlinkedOrderLabel.trim())) continue
    out.push({
      id: `sale-orphan-${s.id}`,
      severity: 'info',
      kind: 'sold_orphan',
      title: `Sold inventory orphan · ${s.itemLabel}`,
      detail: `${s.qty} unit(s) marked sold with no order link or label`,
      amount: null,
      href: `/admin/inventory/${s.itemId}`,
    })
  }

  out.sort((a, b) => {
    const sr = severityRank(a.severity) - severityRank(b.severity)
    if (sr !== 0) return sr
    return (b.amount ?? 0) - (a.amount ?? 0)
  })
  return out
}

export function buildCompanyAudit(input: {
  sheets: OrderSheetRow[]
  txExpense: TxExpenseRow[]
  txFlow: TxFlowRow[]
  accounts: AccountRef[]
  orderInflows: OrderInflowTxRow[]
  auditInflows: CompanyAuditInflowRow[]
  auditOutflows: CompanyAuditOutflowRow[]
  stockRows: CompanyAuditStockRow[]
  sales: CompanyAuditSaleRow[]
  liveByVariantId: Record<string, number>
  range?: { start: Date; end: Date }
}): CompanyAuditResult {
  const realized = summarizeDashboardKpis(input.sheets, input.txExpense, input.range)
  const cashByAccount = summarizeTransactionFlows(input.txFlow, input.accounts, input.range)
  const cashOnHand = roundMoney(cashByAccount.reduce((s, a) => s + a.net, 0))
  const stock = summarizeInventoryStock(input.stockRows, input.liveByVariantId)

  const inRange = (d: Date) => !input.range || (d >= input.range.start && d < input.range.end)
  const cashInflow = roundMoney(
    input.txFlow
      .filter((t) => inRange(t.date) && t.direction === 'INFLOW')
      .reduce((s, t) => s + t.amount, 0),
  )
  const cashOutflow = roundMoney(
    input.txFlow
      .filter((t) => inRange(t.date) && t.direction === 'OUTFLOW')
      .reduce((s, t) => s + t.amount, 0),
  )

  const mismatches = findSheetInflowMismatches(input.sheets, input.orderInflows, input.range)
  const exceptions = buildCompanyAuditExceptions({
    mismatches,
    inflows: input.auditInflows,
    outflows: input.auditOutflows,
    stockRows: input.stockRows,
    sales: input.sales,
    liveByVariantId: input.liveByVariantId,
    range: input.range,
  })

  const counts = { red: 0, amber: 0, info: 0, total: exceptions.length }
  for (const e of exceptions) counts[e.severity] += 1

  return {
    kpis: {
      cashOnHand,
      stockAtCost: stock.stockAtCost,
      stockAtPotential: stock.stockAtPotential,
      realizedProfit: realized.profit,
      unrealizedMargin: stock.unrealizedMargin,
    },
    bridge: {
      income: realized.income,
      cogs: realized.purchasePrice,
      gross: roundMoney(realized.income - realized.purchasePrice),
      opex: realized.generalExpenses,
      profit: realized.profit,
    },
    realized,
    cashByAccount,
    books: {
      cash: {
        inflow: cashInflow,
        outflow: cashOutflow,
        net: roundMoney(cashInflow - cashOutflow),
      },
      orders: {
        selling: realized.income,
        cost: realized.purchasePrice,
        margin: roundMoney(realized.income - realized.purchasePrice),
      },
      stock,
    },
    exceptions,
    exceptionCounts: counts,
  }
}

export function inventoryRowsForAudit(
  items: Array<{
    id: string
    qtyOnHand: number
    purchasePrice: { toString(): string } | number | null
    potentialPrice: { toString(): string } | number | null
    variantId: string | null
    customName: string | null
    product: { name: string } | null
    variant: { sku: string; metalType: string; size: string | null } | null
  }>,
): CompanyAuditStockRow[] {
  return items.map((r) => ({
    id: r.id,
    label: inventoryDisplayName(r),
    qtyOnHand: r.qtyOnHand,
    purchasePrice: r.purchasePrice != null ? Number(r.purchasePrice) : null,
    potentialPrice: r.potentialPrice != null ? Number(r.potentialPrice) : null,
    variantId: r.variantId,
  }))
}
