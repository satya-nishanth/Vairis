import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  summarizeDashboardKpis,
  summarizeTransactionFlows,
  toDateInput,
  sheetTotals,
  shortFinanceId,
} from '@/lib/finance'

export const dynamic = 'force-dynamic'

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const th: React.CSSProperties = { textAlign: 'left', padding: 10 }
const td: React.CSSProperties = { padding: 10 }

export default async function FinanceDashboardPage() {
  const [expenses, sheets, accounts, transactions, forReviewCount] = await Promise.all([
    prisma.generalExpense.findMany({ include: { account: { select: { name: true } } } }),
    prisma.orderFinance.findMany({
      include: {
        order: { select: { id: true, createdAt: true, contactName: true } },
        lines: true,
        paidToAccount: { select: { id: true, name: true, type: true } },
      },
    }),
    prisma.financeAccount.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.financeTransaction.findMany({
      select: {
        date: true,
        direction: true,
        amount: true,
        paidThroughAccountId: true,
        transferToAccountId: true,
        unlinkedOrderLabels: true,
        orders: { select: { orderId: true } },
      },
    }),
    prisma.financeTransaction.count({
      where: { reviewComplete: false },
    }),
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
      orderLabel: s.orderId,
      orderCreatedAt: s.order.createdAt,
      cost: totals.cost,
      sellingPrice: totals.selling,
      paidToAccountId: s.paidToAccountId,
    }
  })

  const kpis = summarizeDashboardKpis(
    sheetRows,
    transactions.map((t) => ({
      date: t.date,
      direction: t.direction,
      amount: Number(t.amount),
      relatedToOrder: t.orders.length > 0 || t.unlinkedOrderLabels.length > 0,
    })),
  )

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

  const contributions = expenses.filter((e) => e.paidThrough === 'PERSONAL_FUNDS')
  const receipts = sheets.filter((s) => s.paidToAccount.type === 'PARTNER')

  const cards = [
    { label: 'Income', value: inr(kpis.income) },
    { label: 'Purchase price', value: inr(kpis.purchasePrice) },
    { label: 'General expenses', value: inr(kpis.generalExpenses) },
    { label: 'Profit', value: inr(kpis.profit) },
  ]

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14 }}>
            <div style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase' }}>{c.label}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: 4 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {forReviewCount > 0 && (
        <div
          role="status"
          style={{
            marginBottom: 24,
            padding: '14px 16px',
            border: '1px solid #f59e0b',
            borderRadius: 10,
            background: '#fffbeb',
            fontSize: '0.875rem',
            color: '#92400e',
          }}
        >
          There {forReviewCount === 1 ? 'is' : 'are'} {forReviewCount} transaction
          {forReviewCount === 1 ? '' : 's'} for your review on the{' '}
          <Link href="/admin/finance/transactions" style={{ color: '#92400e', fontWeight: 600 }}>
            transactions page
          </Link>
          .
        </div>
      )}

      <h2 style={{ fontSize: '0.9375rem', marginBottom: 8 }}>By account</h2>
      <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 0, marginBottom: 8 }}>
        From transactions — wallet used (which bank account). Net = inflow − outflow.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 28, fontSize: '0.8125rem', background: '#fff' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
            <th style={th}>Account</th>
            <th style={{ ...th, textAlign: 'right' }}>Net</th>
            <th style={{ ...th, textAlign: 'right' }}>Inflow</th>
            <th style={{ ...th, textAlign: 'right' }}>Outflow</th>
          </tr>
        </thead>
        <tbody>
          {byAccountFlows.map((p) => (
            <tr key={p.accountId} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={td}>{p.accountName}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{inr(p.net)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{inr(p.inflow)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{inr(p.outflow)}</td>
            </tr>
          ))}
          {byAccountFlows.length === 0 && (
            <tr>
              <td colSpan={4} style={{ ...td, color: '#6b7280' }}>
                No accounts yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: '0.9375rem' }}>Personal contributions ({contributions.length})</h2>
          <ul style={{ fontSize: '0.8125rem', paddingLeft: 18 }}>
            {contributions.slice(0, 8).map((e) => (
              <li key={e.id}>
                {toDateInput(e.date)} · {e.account?.name ?? '—'} · {inr(Number(e.amount))} — {e.description}
              </li>
            ))}
            {contributions.length === 0 && <li style={{ color: '#6b7280' }}>None yet</li>}
          </ul>
        </div>
        <div>
          <h2 style={{ fontSize: '0.9375rem' }}>Partner receipts held ({receipts.length})</h2>
          <ul style={{ fontSize: '0.8125rem', paddingLeft: 18 }}>
            {receipts.slice(0, 8).map((s) => {
              const t = sheetTotals(
                s.lines.map((l) => ({
                  kind: l.kind,
                  costPrice: Number(l.costPrice),
                  sellingPrice: Number(l.sellingPrice),
                })),
                { roundOffEnabled: s.roundOffEnabled },
              )
              return (
                <li key={s.id}>
                  <span title={s.orderId}>{shortFinanceId(s.orderId)}</span> · {s.paidToAccount.name} · SP{' '}
                  {inr(t.selling)}
                </li>
              )
            })}
            {receipts.length === 0 && <li style={{ color: '#6b7280' }}>None yet</li>}
          </ul>
        </div>
      </div>
    </>
  )
}
