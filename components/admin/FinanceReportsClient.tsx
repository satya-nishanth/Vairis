'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  summarizeTransactionReport,
  istMonthUtcRange,
  istQuarterUtcRange,
  type CategorySlice,
  type MonthBucket,
  type TransactionReport,
} from '@/lib/finance'

type ReportMode = 'month' | 'quarter' | 'year' | 'all'

const GREEN = '#032b24'
const BORDER = '#e5e7eb'
const MUTED = '#6b7280'

/** Forest / sage / clay palette — no purple. */
const PIE_COLORS = [
  '#032b24',
  '#0d5c4d',
  '#1a7a66',
  '#2d9b82',
  '#5bb89f',
  '#8ecfbd',
  '#b7a18a',
  '#8b6914',
  '#a65d4a',
  '#6b7280',
]

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, r, endAngle)
  const end = polar(cx, cy, r, startAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${end.x} ${end.y} A ${r} ${r} 0 ${large} 1 ${start.x} ${start.y} Z`
}

function PieChart({ slices, emptyLabel }: { slices: CategorySlice[]; emptyLabel: string }) {
  const total = slices.reduce((s, x) => s + x.amount, 0)
  if (total <= 0) {
    return (
      <div
        style={{
          height: 220,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: MUTED,
          fontSize: '0.8125rem',
        }}
      >
        {emptyLabel}
      </div>
    )
  }

  const cx = 110
  const cy = 110
  const r = 100
  let angle = 0
  const paths = slices.map((slice, i) => {
    const sweep = (slice.amount / total) * 360
    const start = angle
    const end = angle + Math.max(sweep, 0.01)
    angle = end
    return (
      <path
        key={`${slice.categoryId ?? 'u'}-${i}`}
        d={arcPath(cx, cy, r, start, end)}
        fill={PIE_COLORS[i % PIE_COLORS.length]}
        stroke="#fff"
        strokeWidth={1.5}
      />
    )
  })

  // Full circle when single slice
  if (slices.length === 1) {
    return (
      <svg viewBox="0 0 220 220" width="100%" style={{ maxWidth: 240, margin: '0 auto', display: 'block' }}>
        <circle cx={cx} cy={cy} r={r} fill={PIE_COLORS[0]} />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 220 220" width="100%" style={{ maxWidth: 240, margin: '0 auto', display: 'block' }}>
      {paths}
    </svg>
  )
}

function CategoryLegend({ slices }: { slices: CategorySlice[] }) {
  if (!slices.length) return null
  return (
    <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, fontSize: '0.8125rem' }}>
      {slices.map((s, i) => (
        <li
          key={`${s.categoryId ?? 'u'}-${i}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 0',
            borderBottom: '1px solid #f3f4f6',
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: PIE_COLORS[i % PIE_COLORS.length],
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1, color: '#374151' }}>{s.categoryName}</span>
          <span style={{ color: MUTED, minWidth: 42, textAlign: 'right' }}>{s.pct}%</span>
          <span style={{ fontWeight: 600, minWidth: 72, textAlign: 'right' }}>{inr(s.amount)}</span>
        </li>
      ))}
    </ul>
  )
}

function MonthBars({ months }: { months: MonthBucket[] }) {
  if (!months.length) {
    return <p style={{ color: MUTED, fontSize: '0.8125rem' }}>No monthly data in this period.</p>
  }
  const max = Math.max(...months.map((m) => Math.max(m.inflow, m.outflow)), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {months.map((m) => (
        <div key={`${m.year}-${m.month}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
            <span style={{ fontWeight: 600, color: '#111827' }}>{m.label}</span>
            <span style={{ color: MUTED }}>Net {inr(m.net)}</span>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.6875rem', color: MUTED, width: 52 }}>In</span>
              <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(m.inflow / max) * 100}%`,
                    height: '100%',
                    background: '#1a7a66',
                    borderRadius: 4,
                  }}
                />
              </div>
              <span style={{ fontSize: '0.75rem', minWidth: 72, textAlign: 'right' }}>{inr(m.inflow)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.6875rem', color: MUTED, width: 52 }}>Out</span>
              <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(m.outflow / max) * 100}%`,
                    height: '100%',
                    background: '#a65d4a',
                    borderRadius: 4,
                  }}
                />
              </div>
              <span style={{ fontSize: '0.75rem', minWidth: 72, textAlign: 'right' }}>{inr(m.outflow)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

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

export type ReportTx = {
  date: string
  direction: 'INFLOW' | 'OUTFLOW'
  amount: number
  categoryId: string | null
  categoryName: string | null
}

export function FinanceReportsClient({
  transactions,
  initialMonth,
  initialQuarter,
  initialYear,
  initialMode,
}: {
  transactions: ReportTx[]
  initialMonth: string
  initialQuarter: string
  initialYear: number
  initialMode: ReportMode
}) {
  const router = useRouter()
  const [mode, setMode] = useState<ReportMode>(initialMode)
  const [month, setMonth] = useState(initialMonth)
  const [quarter, setQuarter] = useState(initialQuarter)
  const [year, setYear] = useState(String(initialYear))

  function pushFilters(next: {
    mode: ReportMode
    month: string
    quarter: string
    year: string
  }) {
    const params = new URLSearchParams()
    if (next.mode === 'all') params.set('period', 'all')
    else if (next.mode === 'year') params.set('year', next.year)
    else if (next.mode === 'quarter') params.set('quarter', next.quarter)
    else params.set('month', next.month)
    router.replace(`/admin/finance/reports?${params.toString()}`)
  }

  function selectMode(nextMode: ReportMode) {
    setMode(nextMode)
    pushFilters({ mode: nextMode, month, quarter, year })
  }

  function selectMonth(next: string) {
    setMonth(next)
    pushFilters({ mode: 'month', month: next, quarter, year })
  }

  function selectQuarter(next: string) {
    setQuarter(next)
    pushFilters({ mode: 'quarter', month, quarter: next, year })
  }

  function selectYear(next: string) {
    setYear(next)
    pushFilters({ mode: 'year', month, quarter, year: next })
  }

  const report: TransactionReport = useMemo(() => {
    const rows = transactions.map((t) => ({
      date: new Date(t.date),
      direction: t.direction,
      amount: t.amount,
      categoryId: t.categoryId,
      categoryName: t.categoryName,
    }))
    if (mode === 'all') return summarizeTransactionReport(rows)
    if (mode === 'year') {
      const y = Number(year)
      const range = istMonthUtcRange(y, 1)
      const end = istMonthUtcRange(y, 12).end
      return summarizeTransactionReport(rows, { start: range.start, end })
    }
    if (mode === 'quarter') {
      const [y, q] = quarter.split('-').map(Number)
      return summarizeTransactionReport(rows, istQuarterUtcRange(y, q))
    }
    const [y, m] = month.split('-').map(Number)
    return summarizeTransactionReport(rows, istMonthUtcRange(y, m))
  }, [transactions, mode, month, quarter, year])

  const years = useMemo(() => {
    const set = new Set<number>()
    for (const t of transactions) {
      set.add(new Date(t.date).getFullYear())
    }
    const now = new Date().getFullYear()
    set.add(now)
    return [...set].sort((a, b) => b - a)
  }, [transactions])

  const card: React.CSSProperties = {
    background: '#fff',
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: 16,
  }

  const controlStyle: React.CSSProperties = {
    display: 'block',
    marginTop: 6,
    padding: '14px 16px',
    fontSize: '1rem',
    lineHeight: 1.25,
    minHeight: 48,
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    background: '#fff',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: MUTED,
    fontWeight: 500,
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'flex-end',
          marginBottom: 20,
          ...card,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
              style={{
                border: `1px solid ${mode === value ? GREEN : BORDER}`,
                background: mode === value ? '#e8f2ef' : '#fff',
                color: mode === value ? GREEN : '#374151',
                borderRadius: 999,
                padding: '14px 24px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
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
            <select
              value={year}
              onChange={(e) => selectYear(e.target.value)}
              style={controlStyle}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          { label: 'Inflow', value: inr(report.inflow), color: '#1a7a66' },
          { label: 'Outflow', value: inr(report.outflow), color: '#a65d4a' },
          { label: 'Net', value: inr(report.net), color: GREEN },
        ].map((c) => (
          <div key={c.label} style={card}>
            <div style={{ fontSize: '0.6875rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {c.label}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={card}>
          <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 700 }}>Outflow by category</h2>
          <PieChart slices={report.outflowByCategory} emptyLabel="No outflow in this period" />
          <CategoryLegend slices={report.outflowByCategory} />
        </div>
        <div style={card}>
          <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 700 }}>Inflow by category</h2>
          <PieChart slices={report.inflowByCategory} emptyLabel="No inflow in this period" />
          <CategoryLegend slices={report.inflowByCategory} />
        </div>
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 700 }}>Category totals</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: `1px solid ${BORDER}`, background: '#f7f7f5' }}>
                <th style={{ padding: '10px 12px' }}>Category</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Inflow</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Outflow</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const map = new Map<
                  string,
                  { name: string; inflow: number; outflow: number }
                >()
                for (const s of report.inflowByCategory) {
                  const k = s.categoryId ?? '__u__'
                  map.set(k, { name: s.categoryName, inflow: s.amount, outflow: 0 })
                }
                for (const s of report.outflowByCategory) {
                  const k = s.categoryId ?? '__u__'
                  const cur = map.get(k) ?? { name: s.categoryName, inflow: 0, outflow: 0 }
                  cur.outflow = s.amount
                  map.set(k, cur)
                }
                const rows = [...map.values()].sort(
                  (a, b) => b.inflow + b.outflow - (a.inflow + a.outflow),
                )
                if (!rows.length) {
                  return (
                    <tr>
                      <td colSpan={4} style={{ padding: 16, color: MUTED, textAlign: 'center' }}>
                        No categorized transactions in this period.
                      </td>
                    </tr>
                  )
                }
                return rows.map((r) => (
                  <tr key={r.name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px' }}>{r.name}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1a7a66' }}>
                      {inr(r.inflow)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#a65d4a' }}>
                      {inr(r.outflow)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                      {inr(r.inflow - r.outflow)}
                    </td>
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 700 }}>
          {mode === 'month' ? 'This month' : 'By month'}
        </h2>
        <MonthBars months={report.byMonth} />
      </div>
    </div>
  )
}
