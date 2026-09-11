'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { shortFinanceId } from '@/lib/finance'

export type AllocDraft = {
  key: string
  target: 'ORDER' | 'PURCHASE_BILL'
  orderId?: string
  purchaseBillId?: string
  label: string
  amount: string
}

type DocRow = {
  id: string
  kind: 'ORDER' | 'PURCHASE_BILL'
  title: string
  contact: string
  dateLabel: string
  itemLabel: string
  total: number
  /** Remaining due; 0 = settled; negative = already overpaid (signed). */
  balance: number
  expected: number
  phone?: string
}

const GREEN = '#032b24'
const GREEN_SOFT = '#dceee8'
const BORDER = '#e5e7eb'
const MUTED = '#6b7280'
const LABEL = '#374151'
const AMBER = '#b45309'
const AMBER_BG = '#fffbeb'

const control: React.CSSProperties = {
  width: '100%',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: '0.875rem',
  boxSizing: 'border-box',
  background: '#fff',
  color: '#111827',
}

const sep: React.CSSProperties = {
  color: '#d1d5db',
  margin: '0 6px',
  userSelect: 'none',
}

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function formatDocDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function mapOrder(o: {
  id: string
  contactName?: string
  contactPhone?: string
  createdAt?: string
  itemsLabel?: string
  expected?: number
  balance?: number
  grandTotal?: number
  selling?: number | null
  collected?: number
  orderKind?: 'standalone' | 'parent' | 'child'
  parentOrderId?: string | null
  childCount?: number
}): DocRow {
  const expected =
    o.expected ?? (o.selling && o.selling > 0 ? o.selling : o.grandTotal) ?? 0
  const collected = o.collected ?? 0
  const balance = o.balance ?? round2(expected - collected)
  const kindTag =
    o.orderKind === 'parent'
      ? o.childCount && o.childCount > 0
        ? `Parent · ${o.childCount} delivery`
        : 'Parent'
      : o.orderKind === 'child' && o.parentOrderId
        ? `Child of #${shortFinanceId(o.parentOrderId)}`
        : null
  return {
    id: o.id,
    kind: 'ORDER',
    title: `#${shortFinanceId(o.id)}`,
    contact: o.contactName?.trim() || '—',
    dateLabel: formatDocDate(o.createdAt),
    itemLabel: [kindTag, o.itemsLabel?.trim() || null].filter(Boolean).join(' · ') || '—',
    // Show sheet expected (same basis as Due), not checkout grandTotal.
    total: expected,
    balance: round2(balance),
    expected,
    phone: o.contactPhone?.trim() || undefined,
  }
}

function mapBill(b: {
  id: string
  billNumber?: string
  supplierName?: string
  description?: string
  date?: string
  dateInput?: string
  totalAmount?: number
  balance?: number
  lines?: { description: string; amount: number }[]
}): DocRow {
  const lineSummary =
    b.lines && b.lines.length > 0
      ? b.lines
          .map((l) => l.description.trim())
          .filter(Boolean)
          .slice(0, 3)
          .join(' · ')
      : ''
  return {
    id: b.id,
    kind: 'PURCHASE_BILL',
    title: b.billNumber ? `#${b.billNumber}` : `Bill ${shortFinanceId(b.id)}`,
    contact: b.supplierName?.trim() || '—',
    dateLabel: b.dateInput || formatDocDate(b.date),
    itemLabel: b.description?.trim() || lineSummary || '—',
    total: b.totalAmount ?? 0,
    balance: round2(b.balance ?? b.totalAmount ?? 0),
    expected: b.totalAmount ?? 0,
  }
}

function stubFromAlloc(a: AllocDraft): DocRow {
  const id = a.orderId ?? a.purchaseBillId ?? a.key
  const contact = a.label.includes(' — ') ? a.label.split(' — ').slice(1).join(' — ') : 'Selected'
  return {
    id,
    kind: a.target,
    title: a.label.split(' — ')[0] || (a.target === 'ORDER' ? `#${shortFinanceId(id)}` : `Bill ${shortFinanceId(id)}`),
    contact,
    dateLabel: '—',
    itemLabel: '—',
    total: Number(a.amount) || 0,
    balance: Number(a.amount) || 0,
    expected: Number(a.amount) || 0,
  }
}

function docLabel(doc: DocRow) {
  return doc.kind === 'ORDER'
    ? `Order ${shortFinanceId(doc.id)}${doc.contact !== '—' ? ` — ${doc.contact}` : ''}`
    : `${doc.title}${doc.contact !== '—' ? ` — ${doc.contact}` : ''}`
}

export function FinanceAllocationEditor({
  allocations,
  onChange,
  disabled,
  txAmount,
}: {
  allocations: AllocDraft[]
  onChange: (next: AllocDraft[]) => void
  disabled?: boolean
  txAmount?: number
}) {
  const [target, setTarget] = useState<'NONE' | 'ORDER' | 'PURCHASE_BILL'>(() => {
    if (!allocations.length) return 'NONE'
    return allocations[0]?.target === 'PURCHASE_BILL' ? 'PURCHASE_BILL' : 'ORDER'
  })
  const [query, setQuery] = useState('')
  const [docs, setDocs] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState('')
  const seq = useRef(0)

  const cash = Number(txAmount) > 0 ? round2(Number(txAmount)) : 0
  const allocatedSum = round2(allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0))
  const remaining = round2(Math.max(0, cash - allocatedSum))
  const selectedDocKey = allocations
    .map((a) => a.orderId ?? a.purchaseBillId ?? '')
    .filter(Boolean)
    .sort()
    .join('|')

  // Sync chip when parent loads/edits an existing allocation (useState init only runs once).
  useEffect(() => {
    if (allocations.length === 0) return
    const hasBill = allocations.some((a) => a.purchaseBillId)
    const hasOrder = allocations.some((a) => a.orderId)
    if (hasBill && !hasOrder) setTarget('PURCHASE_BILL')
    else if (hasOrder) setTarget('ORDER')
  }, [allocations])

  useEffect(() => {
    if (disabled || target === 'NONE') {
      setDocs([])
      setHint('')
      setLoading(false)
      return
    }
    const selectedIds = new Set(
      allocations
        .map((a) => (target === 'ORDER' ? a.orderId : a.purchaseBillId))
        .filter(Boolean) as string[],
    )
    const my = ++seq.current
    const q = query.trim()
    setLoading(true)
    const t = setTimeout(() => {
      void (async () => {
        try {
          if (target === 'ORDER') {
            const url =
              q.length >= 2
                ? `/api/admin/finance/order-search?q=${encodeURIComponent(q)}&scope=allocate`
                : `/api/admin/finance/order-search?recent=1&scope=allocate`
            const res = await fetch(url)
            const json = await res.json().catch(() => [])
            if (my !== seq.current) return
            // Recent: open due only. Search: include settled so you can overpay.
            const openOrSelected = (Array.isArray(json) ? json.map(mapOrder) : []).filter((d) => {
              if (selectedIds.has(d.id)) return true
              if (q.length >= 2) return true
              return d.balance > 0.009
            })
            setDocs(openOrSelected.slice(0, 12))
            setHint(
              openOrSelected.length === 0
                ? q
                  ? 'No matching orders'
                  : 'No open orders'
                : '',
            )
          } else {
            const url =
              q.length >= 2
                ? `/api/admin/finance/purchase-bills?q=${encodeURIComponent(q)}`
                : `/api/admin/finance/purchase-bills?open=1`
            const res = await fetch(url)
            const json = await res.json().catch(() => [])
            if (my !== seq.current) return
            const openOrSelected = (Array.isArray(json) ? json.map(mapBill) : []).filter((d) => {
              if (selectedIds.has(d.id)) return true
              if (q.length >= 2) return true
              return d.balance > 0.009
            })
            setDocs(openOrSelected.slice(0, 12))
            setHint(
              openOrSelected.length === 0
                ? q
                  ? 'No matching bills'
                  : 'No open purchase bills'
                : '',
            )
          }
        } catch {
          if (my !== seq.current) return
          setDocs([])
          setHint('Could not load documents')
        } finally {
          if (my === seq.current) setLoading(false)
        }
      })()
    }, q.length >= 2 ? 250 : 0)
    return () => clearTimeout(t)
    // selectedDocKey: refetch when linked docs change, not on every amount edit
    // eslint-disable-next-line react-hooks/exhaustive-deps -- allocations used via selectedIds snapshot
  }, [query, target, disabled, selectedDocKey])

  const listDocs = useMemo(() => {
    const selectedExtra: DocRow[] = []
    for (const a of allocations) {
      if (target === 'ORDER' && a.orderId && !docs.some((d) => d.id === a.orderId)) {
        selectedExtra.push(stubFromAlloc(a))
      }
      if (
        target === 'PURCHASE_BILL' &&
        a.purchaseBillId &&
        !docs.some((d) => d.id === a.purchaseBillId)
      ) {
        selectedExtra.push(stubFromAlloc(a))
      }
    }
    return [...selectedExtra, ...docs]
  }, [docs, allocations, target])

  function selectNone() {
    setTarget('NONE')
    setQuery('')
    setDocs([])
    setHint('')
    onChange([])
  }

  function isSelected(doc: DocRow) {
    if (doc.kind === 'ORDER') return allocations.some((a) => a.orderId === doc.id)
    return allocations.some((a) => a.purchaseBillId === doc.id)
  }

  function amountFor(doc: DocRow) {
    const hit =
      doc.kind === 'ORDER'
        ? allocations.find((a) => a.orderId === doc.id)
        : allocations.find((a) => a.purchaseBillId === doc.id)
    return hit?.amount ?? ''
  }

  function suggestAmount(doc: DocRow, currentAllocs: AllocDraft[]) {
    const used = round2(currentAllocs.reduce((s, a) => s + (Number(a.amount) || 0), 0))
    const cashLeft = cash > 0 ? round2(Math.max(0, cash - used)) : 0
    const due = Math.max(0, doc.balance)
    // Prefer covering due; leftover cash may still be typed to overpay (Overpaid on the doc).
    if (cashLeft > 0.009) {
      if (due > 0.009) return String(Math.min(due, cashLeft))
      return String(cashLeft)
    }
    return due > 0.009 ? String(due) : ''
  }

  function dueLabel(doc: DocRow, allocAmount: string) {
    const due = doc.balance
    const amt = Number(allocAmount) || 0
    if (amt > 0.009 && due < amt - 0.009) {
      const over = round2(amt - Math.max(0, due))
      return { text: `Overpay ${inr(over)}`, color: '#1d4ed8' as const }
    }
    if (due > 0.009) return { text: `Due ${inr(due)}`, color: AMBER }
    if (due < -0.009) return { text: `Overpaid ${inr(-due)}`, color: '#1d4ed8' as const }
    return { text: 'Settled', color: GREEN }
  }

  function toggleDoc(doc: DocRow) {
    if (isSelected(doc)) {
      onChange(
        allocations.filter((a) =>
          doc.kind === 'ORDER' ? a.orderId !== doc.id : a.purchaseBillId !== doc.id,
        ),
      )
      return
    }
    onChange([
      ...allocations,
      {
        key: doc.kind === 'ORDER' ? `o:${doc.id}` : `b:${doc.id}`,
        target: doc.kind,
        orderId: doc.kind === 'ORDER' ? doc.id : undefined,
        purchaseBillId: doc.kind === 'PURCHASE_BILL' ? doc.id : undefined,
        label: docLabel(doc),
        amount: suggestAmount(doc, allocations),
      },
    ])
  }

  function setDocAmount(doc: DocRow, amount: string) {
    const key = doc.kind === 'ORDER' ? `o:${doc.id}` : `b:${doc.id}`
    if (!isSelected(doc)) {
      onChange([
        ...allocations,
        {
          key,
          target: doc.kind,
          orderId: doc.kind === 'ORDER' ? doc.id : undefined,
          purchaseBillId: doc.kind === 'PURCHASE_BILL' ? doc.id : undefined,
          label: docLabel(doc),
          amount,
        },
      ])
      return
    }
    onChange(
      allocations.map((a) => {
        const match = doc.kind === 'ORDER' ? a.orderId === doc.id : a.purchaseBillId === doc.id
        return match ? { ...a, amount } : a
      }),
    )
  }

  if (disabled) return null

  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        background: '#fafafa',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, background: '#fff' }}>
        <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>
          Allocate payment
        </div>
        {cash > 0 ? (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: GREEN }}>{inr(cash)}</span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 999,
                background: remaining > 0.009 ? AMBER_BG : GREEN_SOFT,
                color: remaining > 0.009 ? AMBER : GREEN,
              }}
            >
              {allocations.length === 0
                ? 'Unallocated'
                : remaining > 0.009
                  ? `${inr(remaining)} left`
                  : 'Fully allocated'}
            </span>
          </div>
        ) : (
          <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: MUTED }}>
            Enter the transaction amount first, then allocate below.
          </p>
        )}
        {cash > 0 ? (
          <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: MUTED }}>
            Allocate more than Due to mark the order/bill Overpaid. Total allocated cannot exceed this
            transaction.
          </p>
        ) : null}
      </div>

      <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
        <div className="orders-wb__filter-row" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={target === 'NONE' ? 'orders-wb__chip is-active' : 'orders-wb__chip'}
            onClick={selectNone}
          >
            Unallocated
          </button>
          <button
            type="button"
            className={target === 'ORDER' ? 'orders-wb__chip is-active' : 'orders-wb__chip'}
            onClick={() => {
              setTarget('ORDER')
              setQuery('')
              onChange(allocations.filter((a) => a.target === 'ORDER'))
            }}
          >
            Order invoice
          </button>
          <button
            type="button"
            className={target === 'PURCHASE_BILL' ? 'orders-wb__chip is-active' : 'orders-wb__chip'}
            onClick={() => {
              setTarget('PURCHASE_BILL')
              setQuery('')
              onChange(allocations.filter((a) => a.target === 'PURCHASE_BILL'))
            }}
          >
            Purchase bill
          </button>
        </div>

        {target === 'NONE' ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: MUTED }}>
            This cash stays unallocated until you assign it to an order or purchase bill.
          </p>
        ) : (
          <>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: LABEL }}>
              Open {target === 'ORDER' ? 'orders' : 'purchase bills'} to allocate
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                target === 'ORDER' ? 'Search orders or customers…' : 'Search bill # or supplier…'
              }
              style={control}
            />
            {loading ? (
              <p style={{ margin: 0, fontSize: '0.75rem', color: MUTED }}>Loading…</p>
            ) : hint ? (
              <p style={{ margin: 0, fontSize: '0.75rem', color: MUTED }}>{hint}</p>
            ) : null}

            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                background: '#fff',
                maxHeight: 360,
                overflowY: 'auto',
              }}
            >
              {listDocs.map((doc, i) => {
                const selected = isSelected(doc)
                const amtStr = amountFor(doc)
                const due = dueLabel(doc, amtStr)
                return (
                  <li
                    key={`${doc.kind}:${doc.id}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '28px minmax(0, 1fr) 118px',
                      gap: 10,
                      alignItems: 'center',
                      padding: '12px 12px',
                      borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`,
                      background: selected ? '#f3faf7' : '#fff',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleDoc(doc)}
                      aria-label={`Allocate to ${doc.title}`}
                      style={{ width: 16, height: 16, accentColor: GREEN }}
                    />
                    <button
                      type="button"
                      onClick={() => toggleDoc(doc)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        padding: 0,
                        cursor: 'pointer',
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'baseline',
                          gap: '2px 0',
                          fontSize: '0.8125rem',
                          lineHeight: 1.45,
                          color: '#111827',
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{doc.title}</span>
                        <span style={sep}>·</span>
                        <span style={{ color: MUTED }}>{doc.dateLabel}</span>
                        <span style={sep}>·</span>
                        <span style={{ fontWeight: 600 }}>{doc.contact}</span>
                        {doc.phone ? (
                          <>
                            <span style={sep}>·</span>
                            <span style={{ color: MUTED }}>{doc.phone}</span>
                          </>
                        ) : null}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'baseline',
                          gap: '2px 0',
                          marginTop: 4,
                          fontSize: '0.75rem',
                          lineHeight: 1.4,
                          color: MUTED,
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                            color: '#374151',
                          }}
                          title={doc.itemLabel}
                        >
                          {doc.itemLabel}
                        </span>
                        <span style={sep}>·</span>
                        <span>
                          {doc.kind === 'ORDER' ? 'Sheet' : 'Bill'} {inr(doc.total)}
                        </span>
                        <span style={sep}>·</span>
                        <span style={{ fontWeight: 600, color: due.color }}>{due.text}</span>
                      </div>
                    </button>
                    <input
                      inputMode="decimal"
                      value={amtStr}
                      onChange={(e) => setDocAmount(doc, e.target.value)}
                      onFocus={() => {
                        if (!selected) toggleDoc(doc)
                      }}
                      placeholder="0"
                      aria-label={`Allocation amount for ${doc.title}`}
                      style={{
                        ...control,
                        padding: '8px 10px',
                        textAlign: 'right',
                        fontWeight: 600,
                        opacity: selected ? 1 : 0.55,
                      }}
                    />
                  </li>
                )
              })}
            </ul>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => onChange([])}
                disabled={allocations.length === 0}
                style={{
                  border: 'none',
                  background: 'none',
                  color: allocations.length ? MUTED : '#d1d5db',
                  cursor: allocations.length ? 'pointer' : 'default',
                  fontSize: '0.8125rem',
                  padding: 0,
                }}
              >
                Clear all
              </button>
              <div
                style={{
                  borderRadius: 8,
                  padding: '10px 14px',
                  background: GREEN,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                {allocations.length === 0
                  ? 'No allocation yet'
                  : `Allocate ${inr(allocatedSum)}${cash > 0 && remaining > 0.009 ? ` · ${inr(remaining)} left` : ''}`}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function allocationsToPayload(allocations: AllocDraft[]) {
  return allocations
    .map((a) => ({
      amount: Number(a.amount),
      orderId: a.target === 'ORDER' ? a.orderId ?? null : null,
      purchaseBillId: a.target === 'PURCHASE_BILL' ? a.purchaseBillId ?? null : null,
    }))
    .filter((a) => a.amount > 0 && (a.orderId || a.purchaseBillId))
}

export function allocationsFromRow(row: {
  amount?: number
  allocations?: {
    amount: number
    orderId: string | null
    purchaseBillId: string | null
    label: string
  }[]
  orderIds?: string[]
  orders?: { id: string; contactName: string }[]
}): AllocDraft[] {
  const fromAlloc = (row.allocations ?? [])
    .filter((a) => a.orderId || a.purchaseBillId)
    .map((a, i) => ({
      key: a.orderId ? `o:${a.orderId}` : a.purchaseBillId ? `b:${a.purchaseBillId}` : `a${i}`,
      target: (a.orderId ? 'ORDER' : 'PURCHASE_BILL') as 'ORDER' | 'PURCHASE_BILL',
      orderId: a.orderId ?? undefined,
      purchaseBillId: a.purchaseBillId ?? undefined,
      label: a.label,
      amount: String(a.amount),
    }))
  if (fromAlloc.length) return fromAlloc

  // Legacy cashbook rows: order join only, no FinanceAllocation yet.
  const linked =
    row.orders?.length
      ? row.orders
      : (row.orderIds ?? []).map((id) => ({ id, contactName: '' }))
  if (!linked.length) return []
  const total = Number(row.amount) || 0
  const each =
    linked.length === 1 ? total : Math.round((total / linked.length) * 100) / 100
  return linked.map((o, i) => ({
    key: `o:${o.id}`,
    target: 'ORDER' as const,
    orderId: o.id,
    label: `Order ${shortFinanceId(o.id)}${o.contactName ? ` — ${o.contactName}` : ''}`,
    amount: String(
      i === linked.length - 1
        ? Math.round((total - each * (linked.length - 1)) * 100) / 100
        : each,
    ),
  }))
}
