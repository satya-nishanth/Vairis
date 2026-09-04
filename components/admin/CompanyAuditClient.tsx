'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, Fragment } from 'react'
import type { FinanceReportMode } from '@/lib/finance'
import type { AuditException, CompanyAuditResult } from '@/lib/finance-company-audit'

const GREEN = '#032b24'
const BORDER = '#e5e7eb'
const MUTED = '#6b7280'

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const MONTH_OPTIONS = [
  ['01', 'January'],
  ['02', 'February'],
  ['03', 'March'],
  ['04', 'April'],
  ['05', 'May'],
  ['06', 'June'],
  ['07', 'July'],
  ['08', 'August'],
  ['09', 'September'],
  ['10', 'October'],
  ['11', 'November'],
  ['12', 'December'],
] as const

type Tab = 'overview' | 'reconciliation'

type Props = {
  initialTab: Tab
  periodMode: FinanceReportMode
  monthValue: string
  quarterValue: string
  yearValue: number
  periodLabel: string
  years: number[]
  audit: CompanyAuditResult
}

function severityStyle(s: AuditException['severity']): { bg: string; color: string; label: string } {
  if (s === 'red') return { bg: '#fef2f2', color: '#991b1b', label: 'Red' }
  if (s === 'amber') return { bg: '#fffbeb', color: '#92400e', label: 'Amber' }
  return { bg: '#f3f4f6', color: '#374151', label: 'Info' }
}

function maxAbsNet(rows: CompanyAuditResult['cashByAccount']): number {
  return Math.max(1, ...rows.map((r) => Math.abs(r.net)))
}

const EXCEPTION_GROUP_META: Record<
  string,
  { summary: (n: number) => string; unit: string }
> = {
  sheet_inflow_mismatch: {
    summary: (n) => `Sheet not equal to inflows for ${n} order${n === 1 ? '' : 's'}`,
    unit: 'order',
  },
  inflow_no_order: {
    summary: (n) => `${n} inflow${n === 1 ? '' : 's'} with no order link`,
    unit: 'inflow',
  },
  stock_missing_purchase: {
    summary: (n) => `${n} stock line${n === 1 ? '' : 's'} missing purchase price`,
    unit: 'item',
  },
  stock_missing_valuation: {
    summary: (n) => `${n} stock line${n === 1 ? '' : 's'} missing valuation`,
    unit: 'item',
  },
  large_non_order_outflow: {
    summary: (n) => `${n} large non-order outflow${n === 1 ? '' : 's'}`,
    unit: 'outflow',
  },
  sold_orphan: {
    summary: (n) => `${n} sold inventory record${n === 1 ? '' : 's'} without order ref`,
    unit: 'sale',
  },
}

type ExceptionGroup = {
  kind: string
  severity: AuditException['severity']
  summary: string
  amountTotal: number | null
  items: AuditException[]
}

function groupExceptions(exceptions: AuditException[]): ExceptionGroup[] {
  const order: string[] = []
  const map = new Map<string, AuditException[]>()
  for (const e of exceptions) {
    if (!map.has(e.kind)) {
      order.push(e.kind)
      map.set(e.kind, [])
    }
    map.get(e.kind)!.push(e)
  }
  return order.map((kind) => {
    const items = map.get(kind)!
    const meta = EXCEPTION_GROUP_META[kind]
    const amountTotal = items.reduce((s, e) => s + (e.amount ?? 0), 0)
    const hasAmount = items.some((e) => e.amount != null)
    return {
      kind,
      severity: items[0]!.severity,
      summary: meta?.summary(items.length) ?? `${items.length} × ${kind}`,
      amountTotal: hasAmount ? amountTotal : null,
      items,
    }
  })
}

function prettyPeriodLabel(
  mode: FinanceReportMode,
  month: string,
  quarter: string,
  year: number,
  serverLabel: string,
): string {
  if (serverLabel) return serverLabel
  if (mode === 'all') return 'All time'
  if (mode === 'year') return String(year)
  if (mode === 'quarter') {
    const [y, q] = quarter.split('-')
    return `${y} Q${q}`
  }
  const [y, m] = month.split('-')
  const name = MONTH_OPTIONS.find(([v]) => v === m)?.[1] ?? m
  return `${name} ${y}`
}

export function CompanyAuditClient({
  initialTab,
  periodMode,
  monthValue,
  quarterValue,
  yearValue,
  periodLabel,
  years,
  audit,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [mode, setMode] = useState<FinanceReportMode>(periodMode)
  const [month, setMonth] = useState(monthValue)
  const [quarter, setQuarter] = useState(quarterValue)
  const [year, setYear] = useState(String(yearValue))
  const [expandedKinds, setExpandedKinds] = useState<Record<string, boolean>>({})

  const displayPeriod = prettyPeriodLabel(mode, month, quarter, Number(year), periodLabel)
  const exceptionGroups = useMemo(() => groupExceptions(audit.exceptions), [audit.exceptions])

  function toggleGroup(kind: string) {
    setExpandedKinds((prev) => ({ ...prev, [kind]: !prev[kind] }))
  }

  function pushFilters(next: {
    mode: FinanceReportMode
    month: string
    quarter: string
    year: string
    tab?: Tab
  }) {
    const params = new URLSearchParams()
    const t = next.tab ?? tab
    if (t !== 'overview') params.set('tab', t)
    if (next.mode === 'all') params.set('period', 'all')
    else if (next.mode === 'year') params.set('year', next.year)
    else if (next.mode === 'quarter') params.set('quarter', next.quarter)
    else params.set('month', next.month)
    const qs = params.toString()
    router.push(qs ? `/admin/finance/company-audit?${qs}` : '/admin/finance/company-audit')
  }

  function selectMode(nextMode: FinanceReportMode) {
    setMode(nextMode)
    pushFilters({ mode: nextMode, month, quarter, year })
  }

  function selectMonth(next: string) {
    setMonth(next)
    setMode('month')
    pushFilters({ mode: 'month', month: next, quarter, year })
  }

  function selectQuarter(next: string) {
    setQuarter(next)
    setMode('quarter')
    pushFilters({ mode: 'quarter', month, quarter: next, year })
  }

  function selectYear(next: string) {
    setYear(next)
    setMode('year')
    pushFilters({ mode: 'year', month, quarter, year: next })
  }

  function switchTab(next: Tab) {
    setTab(next)
    pushFilters({ mode, month, quarter, year, tab: next })
  }

  const { kpis, bridge, cashByAccount, books, exceptions, exceptionCounts } = audit
  const barMax = maxAbsNet(cashByAccount)

  const kpiCards: { label: string; value: number; href: string; note?: string; tone?: 'success' }[] =
    [
      {
        label: 'Cash on hand',
        value: kpis.cashOnHand,
        href: '/admin/finance/transactions',
        note: mode === 'all' ? 'Net of all tx' : `Net · ${displayPeriod}`,
      },
      {
        label: 'Stock @ cost',
        value: kpis.stockAtCost,
        href: '/admin/inventory',
        note: 'Current snapshot',
      },
      {
        label: 'Stock @ potential',
        value: kpis.stockAtPotential,
        href: '/admin/inventory',
        note: 'Potential → live → purchase',
      },
      {
        label: 'Realized profit',
        value: kpis.realizedProfit,
        href: '/admin/finance/orders',
        tone: 'success',
        note: displayPeriod,
      },
      {
        label: 'Unrealized margin',
        value: kpis.unrealizedMargin,
        href: '/admin/inventory',
        note: 'Potential − cost',
      },
    ]

  const controlStyle: React.CSSProperties = {
    display: 'block',
    marginTop: 4,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: '0.875rem',
    background: '#fff',
    minWidth: 120,
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    color: MUTED,
  }

  return (
    <div className="company-audit">
      <div className="company-audit__period-bar">
        <div className="company-audit__mode-pills">
          {(
            [
              ['month', 'Month'],
              ['quarter', 'Quarter'],
              ['year', 'Year'],
              ['all', 'All time'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => selectMode(value)}
              className={mode === value ? 'is-active' : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'month' && (
          <>
            <label style={labelStyle}>
              Year
              <select
                value={month.split('-')[0]}
                onChange={(e) => {
                  const m = month.split('-')[1] ?? '01'
                  selectMonth(`${e.target.value}-${m}`)
                }}
                style={controlStyle}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Month
              <select
                value={month.split('-')[1] ?? '01'}
                onChange={(e) => {
                  const y = month.split('-')[0]
                  selectMonth(`${y}-${e.target.value}`)
                }}
                style={controlStyle}
              >
                {MONTH_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {mode === 'quarter' && (
          <>
            <label style={labelStyle}>
              Year
              <select
                value={quarter.split('-')[0]}
                onChange={(e) => {
                  const q = quarter.split('-')[1] ?? '1'
                  selectQuarter(`${e.target.value}-${q}`)
                }}
                style={controlStyle}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Quarter
              <select
                value={quarter.split('-')[1] ?? '1'}
                onChange={(e) => {
                  const y = quarter.split('-')[0]
                  selectQuarter(`${y}-${e.target.value}`)
                }}
                style={controlStyle}
              >
                <option value="1">Q1 (Jan–Mar)</option>
                <option value="2">Q2 (Apr–Jun)</option>
                <option value="3">Q3 (Jul–Sep)</option>
                <option value="4">Q4 (Oct–Dec)</option>
              </select>
            </label>
          </>
        )}

        {mode === 'year' && (
          <label style={labelStyle}>
            Year
            <select value={year} onChange={(e) => selectYear(e.target.value)} style={controlStyle}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p className="company-audit__hint">
        Trading &amp; cash use {displayPeriod}. Inventory KPIs are always a current snapshot.
      </p>

      <div className="company-audit__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'overview'}
          className={tab === 'overview' ? 'is-active' : undefined}
          onClick={() => switchTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'reconciliation'}
          className={tab === 'reconciliation' ? 'is-active' : undefined}
          onClick={() => switchTab('reconciliation')}
        >
          Reconciliation
          {exceptionCounts.total > 0 && (
            <span className="company-audit__badge" aria-label={`${exceptionCounts.total} exceptions`}>
              {exceptionCounts.total}
            </span>
          )}
        </button>
      </div>

      {tab === 'overview' && (
        <div role="tabpanel">
          <div className="company-audit__kpis">
            {kpiCards.map((c) => (
              <Link key={c.label} href={c.href} className="company-audit__kpi">
                <div className="company-audit__kpi-label">{c.label}</div>
                <div
                  className="company-audit__kpi-value"
                  style={c.tone === 'success' ? { color: GREEN } : undefined}
                >
                  {inr(c.value)}
                </div>
                {c.note && <div className="company-audit__kpi-note">{c.note}</div>}
              </Link>
            ))}
          </div>

          <div className="company-audit__grid2">
            <section className="company-audit__panel">
              <h2>Where money sits</h2>
              <p className="company-audit__sub">Net by account for {displayPeriod}</p>
              {cashByAccount.length === 0 ? (
                <p style={{ color: MUTED, fontSize: '0.8125rem' }}>No accounts yet.</p>
              ) : (
                <ul className="company-audit__bars">
                  {cashByAccount.map((a) => {
                    const pct = Math.round((Math.abs(a.net) / barMax) * 100)
                    const negative = a.net < 0
                    return (
                      <li key={a.accountId}>
                        <div className="company-audit__bar-meta">
                          <span>{a.accountName}</span>
                          <strong style={{ color: negative ? '#991b1b' : GREEN }}>{inr(a.net)}</strong>
                        </div>
                        <div className="company-audit__bar-track">
                          <div
                            className="company-audit__bar-fill"
                            style={{
                              width: `${pct}%`,
                              background: negative ? '#fca5a5' : GREEN,
                            }}
                          />
                        </div>
                        <div className="company-audit__bar-sub">
                          In {inr(a.inflow)} · Out {inr(a.outflow)}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              <Link href="/admin/finance/transactions" className="company-audit__link">
                Open transactions →
              </Link>
            </section>

            <section className="company-audit__panel">
              <h2>P&amp;L bridge</h2>
              <p className="company-audit__sub">Trading basis · {displayPeriod}</p>
              <dl className="company-audit__bridge">
                <div>
                  <dt>Order income</dt>
                  <dd>{inr(bridge.income)}</dd>
                </div>
                <div>
                  <dt>− Cost of goods</dt>
                  <dd>{inr(bridge.cogs)}</dd>
                </div>
                <div className="is-mid">
                  <dt>= Gross margin</dt>
                  <dd>{inr(bridge.gross)}</dd>
                </div>
                <div>
                  <dt>− Operating outflows</dt>
                  <dd>{inr(bridge.opex)}</dd>
                </div>
                <div className="is-total">
                  <dt>= Realized profit</dt>
                  <dd>{inr(bridge.profit)}</dd>
                </div>
              </dl>
              <p className="company-audit__footnote">
                Unrealized inventory margin {inr(kpis.unrealizedMargin)} shown separately — not mixed
                into cash profit.
              </p>
              <Link href="/admin/finance/orders" className="company-audit__link">
                Open order sheets →
              </Link>
            </section>
          </div>
        </div>
      )}

      {tab === 'reconciliation' && (
        <div role="tabpanel">
          <div className="company-audit__books">
            <section className="company-audit__book">
              <h3>Cash</h3>
              <dl>
                <div>
                  <dt>Inflows</dt>
                  <dd>{inr(books.cash.inflow)}</dd>
                </div>
                <div>
                  <dt>Outflows</dt>
                  <dd>{inr(books.cash.outflow)}</dd>
                </div>
                <div>
                  <dt>Net</dt>
                  <dd>{inr(books.cash.net)}</dd>
                </div>
              </dl>
            </section>
            <section className="company-audit__book">
              <h3>Orders</h3>
              <dl>
                <div>
                  <dt>Selling</dt>
                  <dd>{inr(books.orders.selling)}</dd>
                </div>
                <div>
                  <dt>Cost</dt>
                  <dd>{inr(books.orders.cost)}</dd>
                </div>
                <div>
                  <dt>Margin</dt>
                  <dd>{inr(books.orders.margin)}</dd>
                </div>
              </dl>
            </section>
            <section className="company-audit__book">
              <h3>Stock</h3>
              <dl>
                <div>
                  <dt>@ cost</dt>
                  <dd>{inr(books.stock.stockAtCost)}</dd>
                </div>
                <div>
                  <dt>@ potential</dt>
                  <dd>{inr(books.stock.stockAtPotential)}</dd>
                </div>
                <div>
                  <dt>Unrealized</dt>
                  <dd>{inr(books.stock.unrealizedMargin)}</dd>
                </div>
              </dl>
            </section>
          </div>

          <div className="company-audit__legend">
            <strong>Expected links</strong>
            <span>Sheet selling ↔ Cash inflow</span>
            <span>Mark sold ↔ Stock qty</span>
            <span>Goods outflow ↔ Inventory purchase</span>
          </div>

          <section className="company-audit__panel">
            <h2>
              Exceptions{' '}
              <span style={{ fontWeight: 400, color: MUTED, fontSize: '0.8125rem' }}>
                {exceptionCounts.red} red · {exceptionCounts.amber} amber · {exceptionCounts.info}{' '}
                info
              </span>
            </h2>
            {exceptions.length === 0 ? (
              <p style={{ color: MUTED, fontSize: '0.875rem' }}>
                Books look aligned for this period. Fix data in Transactions, Order sheets, or
                Inventory if something new appears.
              </p>
            ) : (
              <div className="company-audit__table-wrap">
                <table className="company-audit__table">
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Issue</th>
                      <th>Detail</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {exceptionGroups.map((g) => {
                      const sev = severityStyle(g.severity)
                      const open = Boolean(expandedKinds[g.kind])
                      return (
                        <Fragment key={g.kind}>
                          <tr
                            className="company-audit__group-row"
                            onClick={() => toggleGroup(g.kind)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <span
                                className="company-audit__sev"
                                style={{ background: sev.bg, color: sev.color }}
                              >
                                {sev.label}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              <span className="company-audit__chevron" aria-hidden>
                                {open ? '▾' : '▸'}
                              </span>{' '}
                              {g.summary}
                            </td>
                            <td style={{ color: MUTED, fontSize: '0.8125rem' }}>
                              {open
                                ? 'Click to collapse'
                                : `Click to view ${g.items.length} item${g.items.length === 1 ? '' : 's'}`}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {g.amountTotal != null ? inr(g.amountTotal) : '—'}
                            </td>
                            <td />
                          </tr>
                          {open &&
                            g.items.map((e) => (
                              <tr key={e.id} className="company-audit__child-row">
                                <td />
                                <td style={{ fontWeight: 500, paddingLeft: 28 }}>{e.title}</td>
                                <td style={{ color: MUTED, fontSize: '0.8125rem' }}>{e.detail}</td>
                                <td style={{ textAlign: 'right' }}>
                                  {e.amount != null ? inr(e.amount) : '—'}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <Link
                                    href={e.href}
                                    style={{ color: GREEN, fontSize: '0.8125rem' }}
                                    onClick={(ev) => ev.stopPropagation()}
                                  >
                                    Open
                                  </Link>
                                </td>
                              </tr>
                            ))}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="company-audit__footnote">
              Exceptions clear when the underlying record is fixed — no dismiss in v1.
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
