import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  PERSON_LABEL,
  summarizeFinance,
  istMonthUtcRange,
  istYearMonth,
  toDateInput,
  orderCost,
  orderProfit,
} from '@/lib/finance'

export const dynamic = 'force-dynamic'

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const th: React.CSSProperties = { textAlign: 'left', padding: 10 }
const td: React.CSSProperties = { padding: 10 }

export default async function FinanceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const now = istYearMonth(new Date())
  const monthValue = month && /^\d{4}-\d{2}$/.test(month) ? month : `${now.year}-${String(now.month).padStart(2, '0')}`
  const allTime = !month || month === 'all'
  const [y, m] = monthValue.split('-').map(Number)
  const range = allTime ? undefined : istMonthUtcRange(y, m)

  const [expenses, sheets] = await Promise.all([
    prisma.generalExpense.findMany(),
    prisma.orderFinance.findMany({
      include: { order: { select: { createdAt: true, contactName: true } } },
    }),
  ])

  const summary = summarizeFinance(
    expenses.map((e) => ({
      date: e.date,
      amount: Number(e.amount),
      paidThrough: e.paidThrough,
      contributor: e.contributor,
    })),
    sheets.map((s) => ({
      orderCreatedAt: s.order.createdAt,
      goldCost: Number(s.goldCost),
      diamondCost: Number(s.diamondCost),
      stonesCost: Number(s.stonesCost),
      sellingPrice: Number(s.sellingPrice),
      customerPaidTo: s.customerPaidTo,
    })),
    range,
  )

  const inRange = (d: Date) => !range || (d >= range.start && d < range.end)
  const monthExpenses = expenses.filter((e) => inRange(e.date))
  const monthSheets = sheets.filter((s) => inRange(s.order.createdAt))
  const contributions = monthExpenses.filter((e) => e.paidThrough === 'PERSONAL_FUNDS')
  const receipts = monthSheets.filter((s) => s.customerPaidTo !== 'VAIRIS_BANK')

  const cards = [
    { label: 'Income (selling prices)', value: inr(summary.income) },
    { label: 'Order CP', value: inr(summary.orderCost) },
    { label: 'General expenses', value: inr(summary.generalExpenses) },
    { label: 'Profit', value: inr(summary.profit) },
  ]

  return (
    <>
      <form method="get" style={{ marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          Month
          <input
            type="month"
            name="month"
            defaultValue={allTime ? '' : monthValue}
            style={{ marginLeft: 8, padding: '6px 8px' }}
          />
        </label>
        <button type="submit" className="admin-btn">
          Apply
        </button>
        <Link href="/admin/finance?month=all" className="admin-btn">
          All time
        </Link>
      </form>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 0 }}>
        {allTime ? 'All time' : `IST month ${monthValue}`}. Profit = order profits − general expenses.
        Store grandTotal is not used.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 16 }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {c.label}
            </div>
            <div style={{ fontSize: '1.25rem', marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>
      <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Per person</h2>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
        Contribution = personal-funds expenses. Receipts held = customer payments received by that person (not
        profit). {allTime ? 'Running totals.' : 'Amounts posted this month.'}
      </p>
      <table className="admin-products" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 10 }}>Person</th>
            <th style={{ textAlign: 'right', padding: 10 }}>Contribution to Vairis</th>
            <th style={{ textAlign: 'right', padding: 10 }}>Receipts held</th>
          </tr>
        </thead>
        <tbody>
          {summary.byPerson.map((p) => (
            <tr key={p.person} style={{ borderTop: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10 }}>{PERSON_LABEL[p.person]}</td>
              <td style={{ padding: 10, textAlign: 'right' }}>{inr(p.contribution)}</td>
              <td style={{ padding: 10, textAlign: 'right' }}>{inr(p.receiptsHeld)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 32 }}>General expenses</h2>
      <table className="admin-products" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Date</th>
            <th style={th}>Description</th>
            <th style={{ ...th, textAlign: 'right' }}>Amount</th>
            <th style={th}>Paid through</th>
          </tr>
        </thead>
        <tbody>
          {monthExpenses.length === 0 && (
            <tr>
              <td colSpan={4} style={{ ...td, color: '#6b7280' }}>
                None
              </td>
            </tr>
          )}
          {monthExpenses.map((e) => (
            <tr key={e.id} style={{ borderTop: '1px solid #f3f4f6' }}>
              <td style={td}>{toDateInput(e.date)}</td>
              <td style={td}>{e.description}</td>
              <td style={{ ...td, textAlign: 'right' }}>{inr(Number(e.amount))}</td>
              <td style={td}>
                {e.paidThrough === 'PERSONAL_FUNDS'
                  ? `Personal · ${e.contributor ? PERSON_LABEL[e.contributor] : '—'}`
                  : 'Vairis bank'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 32 }}>Order sheets</h2>
      <table className="admin-products" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Order</th>
            <th style={th}>Date</th>
            <th style={{ ...th, textAlign: 'right' }}>CP</th>
            <th style={{ ...th, textAlign: 'right' }}>SP</th>
            <th style={{ ...th, textAlign: 'right' }}>Profit</th>
            <th style={th}>Paid to</th>
          </tr>
        </thead>
        <tbody>
          {monthSheets.length === 0 && (
            <tr>
              <td colSpan={6} style={{ ...td, color: '#6b7280' }}>
                None
              </td>
            </tr>
          )}
          {monthSheets.map((s) => {
            const cp = orderCost(Number(s.goldCost), Number(s.diamondCost), Number(s.stonesCost))
            const sp = Number(s.sellingPrice)
            return (
              <tr key={s.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                <td style={td}>{s.order.contactName || s.orderId.slice(0, 8)}</td>
                <td style={td}>{toDateInput(s.order.createdAt)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{inr(cp)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{inr(sp)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{inr(orderProfit(sp, cp))}</td>
                <td style={td}>
                  {s.customerPaidTo === 'VAIRIS_BANK' ? 'Vairis bank' : PERSON_LABEL[s.customerPaidTo]}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 32 }}>Contributions posted</h2>
      <table className="admin-products" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Date</th>
            <th style={th}>Person</th>
            <th style={th}>Description</th>
            <th style={{ ...th, textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {contributions.length === 0 && (
            <tr>
              <td colSpan={4} style={{ ...td, color: '#6b7280' }}>
                None
              </td>
            </tr>
          )}
          {contributions.map((e) => (
            <tr key={e.id} style={{ borderTop: '1px solid #f3f4f6' }}>
              <td style={td}>{toDateInput(e.date)}</td>
              <td style={td}>{e.contributor ? PERSON_LABEL[e.contributor] : '—'}</td>
              <td style={td}>{e.description}</td>
              <td style={{ ...td, textAlign: 'right' }}>{inr(Number(e.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 32 }}>Receipts held posted</h2>
      <table className="admin-products" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Order</th>
            <th style={th}>Date</th>
            <th style={th}>Held by</th>
            <th style={{ ...th, textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {receipts.length === 0 && (
            <tr>
              <td colSpan={4} style={{ ...td, color: '#6b7280' }}>
                None
              </td>
            </tr>
          )}
          {receipts.map((s) => (
            <tr key={s.id} style={{ borderTop: '1px solid #f3f4f6' }}>
              <td style={td}>{s.order.contactName || s.orderId.slice(0, 8)}</td>
              <td style={td}>{toDateInput(s.order.createdAt)}</td>
              <td style={td}>
                {s.customerPaidTo === 'VAIRIS_BANK' ? 'Vairis bank' : PERSON_LABEL[s.customerPaidTo]}
              </td>
              <td style={{ ...td, textAlign: 'right' }}>{inr(Number(s.sellingPrice))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
