import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  findSheetInflowMismatches,
  summarizeDashboardKpis,
  summarizeTransactionFlows,
  sheetTotals,
  roundMoney,
} from '@/lib/finance'
import {
  collectedByOrderIds,
  collectedByPurchaseBillIds,
  orderPaymentSummary,
  purchaseBillPaymentSummary,
} from '@/lib/finance-collections'
import {
  buildCompanyAuditExceptions,
  UNPAID_PURCHASE_BILL_AGE_DAYS,
} from '@/lib/finance-company-audit'

export const dynamic = 'force-dynamic'

const inr = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`

function pctOrDash(n: number | null | undefined): string {
  if (n == null) return '—'
  const rounded = Math.round(n * 10) / 10
  return `${rounded}%`
}

const EXCEPTION_HIGHLIGHT: Record<string, string> = {
  sheet_empty: 'Empty order sheets',
  sheet_inflow_mismatch: 'Sheet SP ≠ inflows',
  sheet_checkout_mismatch: 'Sheet SP ≠ checkout',
  order_unpaid: 'Customer orders unpaid',
  purchase_bill_unpaid_aged: 'Aged unpaid purchase bills',
  txn_for_review: 'Transactions for review',
  stock_missing_valuation: 'Stock missing valuation',
}

export default async function FinanceDashboardPage() {
  const [sheets, accounts, transactions, purchaseBills, forReviewCount] = await Promise.all([
    prisma.orderFinance.findMany({
      include: {
        order: { select: { id: true, createdAt: true, contactName: true, grandTotal: true } },
        lines: true,
      },
    }),
    prisma.financeAccount.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.financeTransaction.findMany({
      select: {
        id: true,
        date: true,
        direction: true,
        amount: true,
        description: true,
        reviewComplete: true,
        paidThroughAccountId: true,
        transferToAccountId: true,
        unlinkedOrderLabels: true,
        category: { select: { name: true } },
        orders: { select: { orderId: true } },
        allocations: { select: { amount: true, orderId: true, purchaseBillId: true } },
      },
    }),
    prisma.purchaseBill.findMany({
      select: {
        id: true,
        billNumber: true,
        supplierName: true,
        date: true,
        totalAmount: true,
        supplierContact: { select: { name: true } },
      },
    }),
    prisma.financeTransaction.count({
      where: { reviewComplete: false },
    }),
  ])

  const sheetOrderIds = sheets.map((s) => s.orderId)
  const [collectedByOrder, paidByBill] = await Promise.all([
    collectedByOrderIds(sheetOrderIds),
    collectedByPurchaseBillIds(purchaseBills.map((b) => b.id)),
  ])

  const sheetRows = sheets.map((s) => {
    const totals = sheetTotals(
      s.lines.map((l) => ({
        kind: l.kind,
        costPrice: Number(l.costPrice),
        sellingPrice: Number(l.sellingPrice),
      })),
      { roundOffEnabled: s.roundOffEnabled },
    )
    return {
      orderId: s.orderId,
      orderLabel: s.order.contactName || s.orderId,
      orderCreatedAt: s.order.createdAt,
      cost: totals.cost,
      sellingPrice: totals.selling,
      paidToAccountId: s.paidToAccountId,
      grandTotal: Number(s.order.grandTotal),
    }
  })

  const txExpense = transactions.map((t) => ({
    date: t.date,
    direction: t.direction,
    amount: Number(t.amount),
    relatedToOrder:
      t.orders.length > 0 ||
      t.unlinkedOrderLabels.length > 0 ||
      t.allocations.some((a) => a.orderId || a.purchaseBillId),
    categoryName: t.category?.name ?? null,
  }))

  const kpis = summarizeDashboardKpis(sheetRows, txExpense)

  const byAccountFlows = summarizeTransactionFlows(
    transactions.map((t) => ({
      date: t.date,
      direction: t.direction,
      amount: Number(t.amount),
      paidThroughAccountId: t.paidThroughAccountId,
      transferToAccountId: t.transferToAccountId,
    })),
    accounts.map((a) => ({ id: a.id, name: a.name, type: a.type })),
  )

  const collections = { settled: 0, partial: 0, unpaid: 0, overpaid: 0, due: 0 }
  const orderPayments = sheetRows.map((s) => {
    const summary = orderPaymentSummary({
      grandTotal: s.grandTotal,
      sheetSelling: s.sellingPrice,
      collected: collectedByOrder.get(s.orderId) ?? 0,
    })
    collections[summary.paymentStatus] += 1
    if (summary.paymentStatus === 'unpaid' || summary.paymentStatus === 'partial') {
      collections.due = roundMoney(collections.due + Math.max(0, summary.balance))
    }
    return {
      orderId: s.orderId,
      label: s.orderLabel,
      orderCreatedAt: s.orderCreatedAt,
      expected: summary.expected,
      collected: summary.collected,
      paymentStatus: summary.paymentStatus,
      grandTotal: s.grandTotal,
      sheetSelling: s.sellingPrice > 0 ? s.sellingPrice : null,
    }
  })

  const billStats = { unpaid: 0, partial: 0, settled: 0, overpaid: 0, due: 0, agedUnpaid: 0 }
  const asOf = new Date()
  const purchaseBillRows = purchaseBills.map((b) => {
    const total = Number(b.totalAmount)
    const paid = paidByBill.get(b.id) ?? 0
    const summary = purchaseBillPaymentSummary(total, paid)
    billStats[summary.paymentStatus] += 1
    if (summary.paymentStatus === 'unpaid' || summary.paymentStatus === 'partial') {
      billStats.due = roundMoney(billStats.due + Math.max(0, summary.balance))
    }
    const ageDays = Math.floor((asOf.getTime() - b.date.getTime()) / (24 * 60 * 60 * 1000))
    if (summary.paymentStatus === 'unpaid' && ageDays >= UNPAID_PURCHASE_BILL_AGE_DAYS) {
      billStats.agedUnpaid = roundMoney(billStats.agedUnpaid + summary.balance)
    }
    return {
      id: b.id,
      billNumber: b.billNumber,
      supplierName: b.supplierName || b.supplierContact?.name || '',
      date: b.date,
      total: summary.total,
      paid: summary.paid,
      paymentStatus: summary.paymentStatus,
    }
  })

  const mismatches = findSheetInflowMismatches(
    sheetRows,
    transactions
      .filter(
        (t) =>
          t.direction === 'INFLOW' &&
          (t.orders.length > 0 || t.allocations.some((a) => a.orderId)),
      )
      .map((t) => {
        const orderAllocs = t.allocations
          .filter((a) => a.orderId)
          .map((a) => ({ orderId: a.orderId!, amount: Number(a.amount) }))
        const fromJoin = t.orders.map((o) => o.orderId)
        const fromAlloc = orderAllocs.map((a) => a.orderId)
        return {
          date: t.date,
          amount: Number(t.amount),
          orderIds: [...new Set([...fromJoin, ...fromAlloc])],
          allocations: orderAllocs.length ? orderAllocs : undefined,
        }
      }),
  )

  const exceptions = buildCompanyAuditExceptions({
    asOf,
    mismatches,
    outflows: transactions
      .filter((t) => t.direction === 'OUTFLOW')
      .map((t) => ({
        id: t.id,
        date: t.date,
        amount: Number(t.amount),
        relatedToOrder:
          t.orders.length > 0 ||
          t.unlinkedOrderLabels.length > 0 ||
          t.allocations.some((a) => a.orderId || a.purchaseBillId),
        description: t.description || null,
      })),
    stockRows: [],
    sales: [],
    liveByVariantId: {},
    purchaseBills: purchaseBillRows,
    orderPayments,
    txAllocations: transactions.map((t) => {
      let allocatedToOrders = 0
      let allocatedToBills = 0
      for (const a of t.allocations) {
        const amt = Number(a.amount)
        if (a.orderId) allocatedToOrders += amt
        if (a.purchaseBillId) allocatedToBills += amt
      }
      return {
        id: t.id,
        date: t.date,
        direction: t.direction,
        amount: Number(t.amount),
        allocatedAmount: allocatedToOrders + allocatedToBills,
        allocatedToOrders,
        allocatedToBills,
        reviewComplete: t.reviewComplete,
        description: t.description || null,
      }
    }),
  })

  const exceptionCounts = { red: 0, amber: 0, info: 0, total: exceptions.length }
  const byKind = new Map<string, number>()
  for (const e of exceptions) {
    exceptionCounts[e.severity] += 1
    byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + 1)
  }
  const exceptionHighlights = [...byKind.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([kind, count]) => ({
      kind,
      count,
      label: EXCEPTION_HIGHLIGHT[kind] ?? kind.replace(/_/g, ' '),
    }))

  const sellBar = Math.max(kpis.selling, 1)
  const purchaseWidth = Math.min(100, Math.round((kpis.purchasePrice / sellBar) * 100))
  const profitWidth = Math.min(100, Math.max(0, 100 - purchaseWidth))

  const cards = [
    {
      label: 'Cash inflow',
      value: inr(kpis.income),
      meta: 'Transaction inflows',
    },
    {
      label: 'General expenses',
      value: inr(kpis.generalExpenses),
      meta: 'Outflows excl. inventory purchases',
    },
  ]

  return (
    <div className="finance-dash">
      <div className="finance-dash__kpis">
        {cards.map((c) => (
          <div key={c.label} className="finance-dash__kpi">
            <div className="finance-dash__kpi-label">{c.label}</div>
            <div className="finance-dash__kpi-value">{c.value}</div>
            <div className="finance-dash__kpi-meta">{c.meta}</div>
          </div>
        ))}
      </div>

      {forReviewCount > 0 && (
        <div className="finance-dash__banner" role="status">
          There {forReviewCount === 1 ? 'is' : 'are'} {forReviewCount} transaction
          {forReviewCount === 1 ? '' : 's'} for your review on the{' '}
          <Link href="/admin/finance/transactions">transactions page</Link>.
        </div>
      )}

      <div className="finance-dash__grid">
        <section className="finance-dash__card">
          <div className="finance-dash__card-head">
            <h2 className="finance-dash__card-title">Order summary</h2>
            <p className="finance-dash__card-sub">
              From order finance sheets · selling, cost, margin
            </p>
          </div>

          <div className="finance-dash__summary-strip">
            <div>
              <span>Selling</span>
              <strong>{inr(kpis.selling)}</strong>
            </div>
            <div>
              <span>Purchasing</span>
              <strong>{inr(kpis.purchasePrice)}</strong>
            </div>
            <div>
              <span>Profit</span>
              <strong>{inr(kpis.orderProfit)}</strong>
            </div>
            <div>
              <span>Profit %</span>
              <strong>{pctOrDash(kpis.orderProfitPct)}</strong>
            </div>
            <div>
              <span>Sheets</span>
              <strong>{kpis.sheetCount}</strong>
            </div>
          </div>

          <div className="finance-dash__bar" aria-hidden>
            <div className="finance-dash__bar-track">
              <div className="finance-dash__bar-purchase" style={{ width: `${purchaseWidth}%` }} />
              <div className="finance-dash__bar-profit" style={{ width: `${profitWidth}%` }} />
            </div>
            <div className="finance-dash__bar-legend">
              <span>
                <i className="finance-dash__swatch finance-dash__swatch--purchase" /> Purchase
              </span>
              <span>
                <i className="finance-dash__swatch finance-dash__swatch--profit" /> Profit
              </span>
            </div>
          </div>

          <Link href="/admin/finance/orders" className="finance-dash__link">
            Open order sheets →
          </Link>
        </section>

        <section className="finance-dash__card">
          <div className="finance-dash__card-head">
            <h2 className="finance-dash__card-title">By account</h2>
            <p className="finance-dash__card-sub">
              From transactions — wallet used. Net = inflow − outflow.
            </p>
          </div>

          <table className="finance-dash__table">
            <thead>
              <tr>
                <th>Account</th>
                <th className="finance-dash__num">Net</th>
                <th className="finance-dash__num">Inflow</th>
                <th className="finance-dash__num">Outflow</th>
              </tr>
            </thead>
            <tbody>
              {byAccountFlows.map((p) => (
                <tr key={p.accountId}>
                  <td>{p.accountName}</td>
                  <td
                    className={`finance-dash__num${p.net < 0 ? ' is-neg' : p.net > 0 ? ' is-pos' : ''}`}
                  >
                    {inr(p.net)}
                  </td>
                  <td className="finance-dash__num">{inr(p.inflow)}</td>
                  <td className="finance-dash__num">{inr(p.outflow)}</td>
                </tr>
              ))}
              {byAccountFlows.length === 0 && (
                <tr>
                  <td colSpan={4} className="finance-dash__empty">
                    No accounts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <div className="finance-dash__ops">
        <section className="finance-dash__card">
          <div className="finance-dash__card-head">
            <h2 className="finance-dash__card-title">Collections</h2>
            <p className="finance-dash__card-sub">Customer orders with finance sheets</p>
          </div>
          <div className="finance-dash__status-row">
            <span className="finance-dash__pill finance-dash__pill--ok">
              Settled <strong>{collections.settled}</strong>
            </span>
            <span className="finance-dash__pill finance-dash__pill--warn">
              Partial <strong>{collections.partial}</strong>
            </span>
            <span className="finance-dash__pill finance-dash__pill--bad">
              Unpaid <strong>{collections.unpaid}</strong>
            </span>
          </div>
          <div className="finance-dash__ops-metric">
            <span className="finance-dash__ops-metric-label">Due (unpaid + partial)</span>
            <strong className="finance-dash__ops-metric-value">{inr(collections.due)}</strong>
            <span className="finance-dash__kpi-meta">
              Expected balance from unpaid &amp; partial orders
            </span>
          </div>
          <Link href="/admin/finance/orders" className="finance-dash__link">
            Open order sheets →
          </Link>
        </section>

        <section className="finance-dash__card">
          <div className="finance-dash__card-head">
            <h2 className="finance-dash__card-title">Exceptions</h2>
            <p className="finance-dash__card-sub">From company audit reconciliation</p>
          </div>
          <div className="finance-dash__status-row">
            <span className="finance-dash__pill finance-dash__pill--bad">
              {exceptionCounts.red} Red
            </span>
            <span className="finance-dash__pill finance-dash__pill--warn">
              {exceptionCounts.amber} Amber
            </span>
            <span className="finance-dash__pill finance-dash__pill--info">
              {exceptionCounts.info} Info
            </span>
          </div>
          {exceptionHighlights.length > 0 ? (
            <ul className="finance-dash__exception-list">
              {exceptionHighlights.map((h) => (
                <li key={h.kind}>
                  <span>{h.label}</span>
                  <strong>{h.count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="finance-dash__kpi-meta" style={{ marginTop: 12 }}>
              No exceptions right now.
            </p>
          )}
          <Link href="/admin/finance/company-audit?tab=reconciliation" className="finance-dash__link">
            View all exceptions →
          </Link>
        </section>

        <section className="finance-dash__card">
          <div className="finance-dash__card-head">
            <h2 className="finance-dash__card-title">Purchase bills</h2>
            <p className="finance-dash__card-sub">Supplier invoices</p>
          </div>
          <div className="finance-dash__status-row">
            <span className="finance-dash__pill finance-dash__pill--bad">
              Unpaid <strong>{billStats.unpaid}</strong>
            </span>
            <span className="finance-dash__pill finance-dash__pill--warn">
              Partial <strong>{billStats.partial}</strong>
            </span>
            <span className="finance-dash__pill finance-dash__pill--ok">
              Settled <strong>{billStats.settled}</strong>
            </span>
          </div>
          <div className="finance-dash__ops-metric">
            <span className="finance-dash__ops-metric-label">Total unpaid</span>
            <strong className="finance-dash__ops-metric-value">{inr(billStats.due)}</strong>
            <span className="finance-dash__kpi-meta">
              Outstanding on unpaid &amp; partial bills · aged &gt;{UNPAID_PURCHASE_BILL_AGE_DAYS}d{' '}
              {inr(billStats.agedUnpaid)}
            </span>
          </div>
          <Link href="/admin/finance/purchase-bills" className="finance-dash__link">
            Open bills →
          </Link>
        </section>
      </div>
    </div>
  )
}
