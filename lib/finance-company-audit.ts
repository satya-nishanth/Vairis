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
import type { SettlementStatus } from '@/lib/finance-settlement'
import { txAllocationStatus } from '@/lib/finance-tx-allocation-status'

/** Non-order OUTFLOWs at or above this amount surface as info exceptions. */
export const LARGE_OUTFLOW_THRESHOLD = 100_000

/** Unpaid purchase bills at least this many days old surface as amber. */
export const UNPAID_PURCHASE_BILL_AGE_DAYS = 30

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

export type CompanyAuditOutflowRow = {
  id: string
  date: Date
  amount: number
  relatedToOrder: boolean
  description: string | null
}

export type CompanyAuditPurchaseBillRow = {
  id: string
  billNumber: string
  supplierName: string
  date: Date
  total: number
  paid: number
  paymentStatus: SettlementStatus
}

export type CompanyAuditOrderPaymentRow = {
  orderId: string
  label: string
  orderCreatedAt: Date
  expected: number
  collected: number
  paymentStatus: SettlementStatus
  /** Checkout total — compared to sheet selling for mismatch warnings. */
  grandTotal: number
  /** Sheet SP sum; null if no sheet lines / zero. */
  sheetSelling: number | null
}

export type CompanyAuditTxAllocRow = {
  id: string
  date: Date
  direction: 'INFLOW' | 'OUTFLOW' | 'TRANSFER'
  amount: number
  allocatedAmount: number
  allocatedToOrders: number
  allocatedToBills: number
  reviewComplete: boolean
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

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / 86_400_000)
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
  outflows: CompanyAuditOutflowRow[]
  stockRows: CompanyAuditStockRow[]
  sales: CompanyAuditSaleRow[]
  liveByVariantId: Record<string, number>
  purchaseBills?: CompanyAuditPurchaseBillRow[]
  orderPayments?: CompanyAuditOrderPaymentRow[]
  txAllocations?: CompanyAuditTxAllocRow[]
  range?: { start: Date; end: Date }
  largeOutflowThreshold?: number
  unpaidBillAgeDays?: number
  /** As-of date for aging (defaults to now, or range.end − 1ms when ranged). */
  asOf?: Date
}): AuditException[] {
  const threshold = input.largeOutflowThreshold ?? LARGE_OUTFLOW_THRESHOLD
  const unpaidAgeDays = input.unpaidBillAgeDays ?? UNPAID_PURCHASE_BILL_AGE_DAYS
  const inRange = (d: Date) => !input.range || (d >= input.range.start && d < input.range.end)
  const asOf =
    input.asOf ??
    (input.range ? new Date(input.range.end.getTime() - 1) : new Date())
  const out: AuditException[] = []

  for (const m of input.mismatches) {
    const delta = roundMoney(m.sheetSelling - m.inflowTotal)
    out.push({
      id: `sheet-inflow-${m.orderId}`,
      severity: 'red',
      kind: 'sheet_inflow_mismatch',
      title: `Sheet ≠ allocated inflow · ${shortFinanceId(m.orderId)}`,
      detail: `Sheet SP ₹${m.sheetSelling.toLocaleString('en-IN')} · Allocated inflows ₹${m.inflowTotal.toLocaleString('en-IN')}`,
      amount: Math.abs(delta),
      href: `/admin/finance/orders?orderId=${encodeURIComponent(m.orderId)}`,
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
      href: `/admin/finance/transactions?edit=${encodeURIComponent(t.id)}`,
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

  for (const o of input.orderPayments ?? []) {
    if (!inRange(o.orderCreatedAt)) continue
    const label = o.label.trim() || shortFinanceId(o.orderId)

    if (
      o.sheetSelling != null &&
      o.sheetSelling > 0.009 &&
      roundMoney(o.sheetSelling) !== roundMoney(o.grandTotal)
    ) {
      const delta = roundMoney(o.sheetSelling - o.grandTotal)
      out.push({
        id: `sheet-checkout-${o.orderId}`,
        severity: 'amber',
        kind: 'sheet_checkout_mismatch',
        title: `Sheet SP ≠ checkout · ${shortFinanceId(o.orderId)}`,
        detail: `${label} · Sheet ₹${o.sheetSelling.toLocaleString('en-IN')} · Checkout ₹${o.grandTotal.toLocaleString('en-IN')}`,
        amount: Math.abs(delta),
        href: `/admin/finance/orders?orderId=${encodeURIComponent(o.orderId)}`,
      })
    }

    if (o.paymentStatus === 'settled' || o.expected <= 0.009) continue
    if (o.paymentStatus === 'unpaid') {
      out.push({
        id: `order-unpaid-${o.orderId}`,
        severity: 'amber',
        kind: 'order_unpaid',
        title: `Order unpaid · ${shortFinanceId(o.orderId)}`,
        detail: `${label} · expected ₹${o.expected.toLocaleString('en-IN')}`,
        amount: o.expected,
        href: `/admin/finance/orders?orderId=${encodeURIComponent(o.orderId)}`,
      })
    } else if (o.paymentStatus === 'partial') {
      const due = roundMoney(o.expected - o.collected)
      out.push({
        id: `order-partial-${o.orderId}`,
        severity: 'amber',
        kind: 'order_partial',
        title: `Order partial · ${shortFinanceId(o.orderId)}`,
        detail: `${label} · collected ₹${o.collected.toLocaleString('en-IN')} of ₹${o.expected.toLocaleString('en-IN')}`,
        amount: due,
        href: `/admin/finance/orders?orderId=${encodeURIComponent(o.orderId)}`,
      })
    } else if (o.paymentStatus === 'overpaid') {
      const over = roundMoney(o.collected - o.expected)
      out.push({
        id: `order-overpaid-${o.orderId}`,
        severity: 'amber',
        kind: 'order_overpaid',
        title: `Order overpaid · ${shortFinanceId(o.orderId)}`,
        detail: `${label} · collected ₹${o.collected.toLocaleString('en-IN')} on ₹${o.expected.toLocaleString('en-IN')}`,
        amount: over,
        href: `/admin/finance/orders?orderId=${encodeURIComponent(o.orderId)}`,
      })
    }
  }

  for (const b of input.purchaseBills ?? []) {
    const label = b.billNumber || shortFinanceId(b.id)
    const supplier = b.supplierName.trim() || 'Supplier'
    const ageDays = daysBetween(b.date, asOf)

    if (b.paymentStatus === 'unpaid' && ageDays >= unpaidAgeDays) {
      out.push({
        id: `bill-unpaid-aged-${b.id}`,
        severity: 'amber',
        kind: 'purchase_bill_unpaid_aged',
        title: `Purchase bill unpaid ${ageDays}d · #${label}`,
        detail: `${supplier} · bill ₹${b.total.toLocaleString('en-IN')} · older than ${unpaidAgeDays} days`,
        amount: b.total,
        href: `/admin/finance/purchase-bills?edit=${encodeURIComponent(b.id)}`,
      })
    }

    if (!inRange(b.date)) continue
    if (b.paymentStatus === 'partial') {
      const due = roundMoney(b.total - b.paid)
      out.push({
        id: `bill-partial-${b.id}`,
        severity: 'amber',
        kind: 'purchase_bill_partial',
        title: `Purchase bill partial · #${label}`,
        detail: `${supplier} · paid ₹${b.paid.toLocaleString('en-IN')} of ₹${b.total.toLocaleString('en-IN')}`,
        amount: due,
        href: `/admin/finance/purchase-bills?edit=${encodeURIComponent(b.id)}`,
      })
    } else if (b.paymentStatus === 'overpaid') {
      const over = roundMoney(b.paid - b.total)
      out.push({
        id: `bill-overpaid-${b.id}`,
        severity: 'amber',
        kind: 'purchase_bill_overpaid',
        title: `Purchase bill overpaid · #${label}`,
        detail: `${supplier} · paid ₹${b.paid.toLocaleString('en-IN')} on bill ₹${b.total.toLocaleString('en-IN')}`,
        amount: over,
        href: `/admin/finance/purchase-bills?edit=${encodeURIComponent(b.id)}`,
      })
    }
  }

  for (const t of input.txAllocations ?? []) {
    if (t.direction === 'TRANSFER' || !inRange(t.date)) continue
    const meta = txAllocationStatus(t.amount, t.allocatedAmount)
    const flow = t.direction === 'INFLOW' ? 'Inflow' : 'Outflow'
    const dateBit = t.date.toISOString().slice(0, 10)
    const descBit = t.description ? ` · ${t.description}` : ''

    if (meta.status === 'over_allocated') {
      out.push({
        id: `tx-over-alloc-${t.id}`,
        severity: 'red',
        kind: 'txn_over_allocated',
        title: `Over-allocated ${flow.toLowerCase()} · ${shortFinanceId(t.id)}`,
        detail: `${dateBit}${descBit} · allocated ₹${t.allocatedAmount.toLocaleString('en-IN')} on txn ₹${t.amount.toLocaleString('en-IN')}`,
        amount: meta.overAllocatedAmount,
        href: `/admin/finance/transactions?edit=${encodeURIComponent(t.id)}`,
      })
    } else if (meta.status === 'partial') {
      out.push({
        id: `tx-partial-alloc-${t.id}`,
        severity: 'amber',
        kind: 'txn_partial_allocation',
        title: `Partially allocated ${flow.toLowerCase()} · ${shortFinanceId(t.id)}`,
        detail: `${dateBit}${descBit} · ₹${meta.unallocatedAmount.toLocaleString('en-IN')} left of ₹${t.amount.toLocaleString('en-IN')}`,
        amount: meta.unallocatedAmount,
        href: `/admin/finance/transactions?edit=${encodeURIComponent(t.id)}`,
      })
    } else if (meta.status === 'unallocated' && t.direction === 'INFLOW') {
      out.push({
        id: `tx-unalloc-inflow-${t.id}`,
        severity: 'amber',
        kind: 'txn_unallocated_inflow',
        title: `Unallocated inflow · ${shortFinanceId(t.id)}`,
        detail: `${dateBit}${descBit} · allocate to an order invoice`,
        amount: t.amount,
        href: `/admin/finance/transactions?edit=${encodeURIComponent(t.id)}`,
      })
    }

    if (t.direction === 'INFLOW' && t.allocatedToBills > 0.009) {
      out.push({
        id: `tx-inflow-to-bill-${t.id}`,
        severity: 'amber',
        kind: 'txn_inflow_to_purchase_bill',
        title: `Inflow allocated to purchase bill · ${shortFinanceId(t.id)}`,
        detail: `${dateBit}${descBit} · ₹${t.allocatedToBills.toLocaleString('en-IN')} on supplier bill(s)`,
        amount: t.allocatedToBills,
        href: `/admin/finance/transactions?edit=${encodeURIComponent(t.id)}`,
      })
    }
    if (t.direction === 'OUTFLOW' && t.allocatedToOrders > 0.009) {
      out.push({
        id: `tx-outflow-to-order-${t.id}`,
        severity: 'amber',
        kind: 'txn_outflow_to_order',
        title: `Outflow allocated to customer order · ${shortFinanceId(t.id)}`,
        detail: `${dateBit}${descBit} · ₹${t.allocatedToOrders.toLocaleString('en-IN')} on order invoice(s)`,
        amount: t.allocatedToOrders,
        href: `/admin/finance/transactions?edit=${encodeURIComponent(t.id)}`,
      })
    }

    if (!t.reviewComplete) {
      out.push({
        id: `tx-for-review-${t.id}`,
        severity: 'info',
        kind: 'txn_for_review',
        title: `For review · ${shortFinanceId(t.id)}`,
        detail: `${dateBit} · ${flow}${descBit}`,
        amount: t.amount,
        href: `/admin/finance/transactions?edit=${encodeURIComponent(t.id)}`,
      })
    }
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
  auditOutflows: CompanyAuditOutflowRow[]
  stockRows: CompanyAuditStockRow[]
  sales: CompanyAuditSaleRow[]
  liveByVariantId: Record<string, number>
  purchaseBills?: CompanyAuditPurchaseBillRow[]
  orderPayments?: CompanyAuditOrderPaymentRow[]
  txAllocations?: CompanyAuditTxAllocRow[]
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
    outflows: input.auditOutflows,
    stockRows: input.stockRows,
    sales: input.sales,
    liveByVariantId: input.liveByVariantId,
    purchaseBills: input.purchaseBills,
    orderPayments: input.orderPayments,
    txAllocations: input.txAllocations,
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
