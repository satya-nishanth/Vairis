'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FINANCE_LINE_KINDS,
  LINE_KIND_LABEL,
  sheetTotals,
  shortFinanceId,
  sumQuotedByKind,
  type OrderItemQuote,
} from '@/lib/finance'
import type { FinanceLineKind } from '@prisma/client'

type Line = {
  id?: string
  kind: FinanceLineKind | string
  costPrice: number
  sellingPrice: number
}

type Sheet = {
  id: string
  orderId: string
  paidToAccountId: string
  paidToAccountName?: string | null
  lines: Line[]
  order?: { contactName: string; grandTotal: number }
}

type Hit = {
  id: string
  contactName: string
  contactPhone: string
  grandTotal: number
  status: string
  hasSheet: boolean
  sheet?: {
    paidToAccountId: string
    lines: Line[]
  } | null
}

type AccountOpt = { id: string; name: string }

type Amounts = Record<FinanceLineKind, { costPrice: string; sellingPrice: string }>

type Editor = {
  revision: number
  orderId: string
  orderLabel: string
  orderMeta: { phone?: string; total?: number; status?: string }
  amounts: Amounts
  paidToAccountId: string
}

/** Server-prefetched selection — avoids mobile client-fetch races. */
export type OrderSheetBoot = {
  orderId: string
  orderLabel: string
  orderMeta: { phone?: string; total?: number; status?: string }
  paidToAccountId: string
  lines: Line[]
  quotes: OrderItemQuote[]
}

const GREEN = '#032b24'
const BORDER = '#e5e7eb'
const MUTED = '#6b7280'
const ORDERS_PATH = '/admin/finance/orders'

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

function emptyAmounts(): Amounts {
  return {
    GOLD: { costPrice: '', sellingPrice: '' },
    DIAMONDS: { costPrice: '', sellingPrice: '' },
    STONES: { costPrice: '', sellingPrice: '' },
    MAKING_CHARGES: { costPrice: '', sellingPrice: '' },
    WASTAGE_CHARGES: { costPrice: '', sellingPrice: '' },
    DELIVERY: { costPrice: '', sellingPrice: '' },
  }
}

function moneyToInput(n: unknown): string {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v) || v === 0) return ''
  return String(v)
}

function amountsFromLines(lines: Line[] | null | undefined): Amounts {
  const next = emptyAmounts()
  for (const l of lines ?? []) {
    const kind = String(l.kind) as FinanceLineKind
    if (!(kind in next)) continue
    next[kind] = {
      costPrice: moneyToInput(l.costPrice),
      sellingPrice: moneyToInput(l.sellingPrice),
    }
  }
  return next
}

function amountsFromBoot(boot: OrderSheetBoot): Amounts {
  let next = amountsFromLines(boot.lines)
  const sellingEmpty = FINANCE_LINE_KINDS.every((k) => !next[k].sellingPrice)
  if (sellingEmpty && boot.quotes.length > 0) {
    const summed = sumQuotedByKind(boot.quotes)
    next = { ...next }
    for (const kind of FINANCE_LINE_KINDS) {
      next[kind] = {
        ...next[kind],
        sellingPrice: moneyToInput(summed[kind]),
      }
    }
  }
  return next
}

function parseAmounts(amounts: Amounts) {
  return FINANCE_LINE_KINDS.map((kind) => ({
    kind,
    costPrice: Number(amounts[kind].costPrice) || 0,
    sellingPrice: Number(amounts[kind].sellingPrice) || 0,
  }))
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function orderHref(orderId: string) {
  return `${ORDERS_PATH}?orderId=${encodeURIComponent(orderId)}`
}

export function OrderFinanceManager({
  initial,
  accounts,
  defaultPaidToAccountId,
  recentOrders = [],
  selectedOrderId = null,
  boot = null,
  initialSearchQuery = null,
  initialSearchHits = null,
}: {
  initial: Sheet[]
  accounts: AccountOpt[]
  defaultPaidToAccountId: string | null
  recentOrders?: Hit[]
  selectedOrderId?: string | null
  boot?: OrderSheetBoot | null
  /** From ?q= — mobile search uses full navigation (same reliability as latest-order links). */
  initialSearchQuery?: string | null
  initialSearchHits?: Hit[] | null
}) {
  const router = useRouter()
  const fallbackPaidTo = defaultPaidToAccountId ?? accounts[0]?.id ?? ''

  const [rows, setRows] = useState(initial)
  // Search box is uncontrolled (defaultValue) so mobile GET submit sends what was typed.
  const [query, setQuery] = useState(() => initialSearchQuery ?? '')
  const [hits, setHits] = useState<Hit[]>(() => initialSearchHits ?? [])
  const [searching, setSearching] = useState(() => Boolean(initialSearchQuery))
  const [searchHint, setSearchHint] = useState(() => {
    if (!initialSearchQuery) return ''
    const n = initialSearchHits?.length ?? 0
    return n === 0 ? 'No matching orders found' : `${n} result${n === 1 ? '' : 's'}`
  })
  const [editor, setEditor] = useState<Editor>(() =>
    boot
      ? {
          revision: 1,
          orderId: boot.orderId,
          orderLabel: boot.orderLabel,
          orderMeta: boot.orderMeta,
          amounts: amountsFromBoot(boot),
          paidToAccountId: boot.paidToAccountId || fallbackPaidTo,
        }
      : {
          revision: 0,
          orderId: '',
          orderLabel: '',
          orderMeta: {},
          amounts: emptyAmounts(),
          paidToAccountId: fallbackPaidTo,
        },
  )
  const [quotes] = useState<OrderItemQuote[]>(() => boot?.quotes ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(() =>
    selectedOrderId && !boot ? 'Order not found' : '',
  )
  const searchSeq = useRef(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const parsedLines = parseAmounts(editor.amounts)
  const totals = sheetTotals(parsedLines)
  const listOrders = searching && (hits.length > 0 || Boolean(initialSearchQuery)) ? hits : recentOrders
  const listLabel = searching ? 'Search results' : 'Latest orders'
  const quoteCols = quotes.length
  const linesGridStyle: React.CSSProperties = {
    gridTemplateColumns:
      quoteCols > 0
        ? `minmax(110px, 1.1fr) ${'minmax(88px, 1fr) '.repeat(quoteCols)}minmax(100px, 1fr) minmax(100px, 1fr)`
        : 'minmax(120px, 1.2fr) 1fr 1fr',
  }
  const locked = !editor.orderId

  function setAmount(kind: FinanceLineKind, field: 'costPrice' | 'sellingPrice', value: string) {
    setEditor((prev) => ({
      ...prev,
      amounts: {
        ...prev.amounts,
        [kind]: { ...prev.amounts[kind], [field]: value },
      },
    }))
  }

  async function fetchHits(raw: string) {
    const seq = ++searchSeq.current
    const trimmed = raw.trim()
    setQuery(trimmed)
    if (trimmed.length < 2) {
      setHits([])
      setSearching(false)
      setSearchHint(trimmed.length === 0 ? '' : 'Type at least 2 characters')
      return
    }
    setSearching(true)
    setSearchHint('Searching…')
    try {
      const res = await fetch(`/api/admin/finance/order-search?q=${encodeURIComponent(trimmed)}`)
      if (seq !== searchSeq.current) return
      if (!res.ok) {
        setHits([])
        setSearchHint('Search failed — try again')
        return
      }
      const next = (await res.json()) as Hit[]
      if (seq !== searchSeq.current) return
      const rowsFound = Array.isArray(next) ? next : []
      setHits(rowsFound)
      setSearching(true)
      setSearchHint(
        rowsFound.length === 0
          ? 'No matching orders found'
          : `${rowsFound.length} result${rowsFound.length === 1 ? '' : 's'}`,
      )
    } catch {
      if (seq !== searchSeq.current) return
      setHits([])
      setSearchHint('Search failed — try again')
    }
  }

  function onSearchTyping(q: string) {
    setQuery(q)
    const mobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    if (mobile) return
    void fetchHits(q)
  }

  /** Mobile: native GET (browser sends input value). Desktop: client fetch. */
  function onSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    const typed = (searchInputRef.current?.value ?? '').trim()
    const mobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    if (typed.length < 2) {
      e.preventDefault()
      setSearchHint('Type at least 2 characters, then tap Search')
      return
    }
    if (!mobile) {
      e.preventDefault()
      void fetchHits(typed)
    }
    // mobile: do not preventDefault — form GET → /admin/finance/orders?q=…
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!editor.orderId) {
      setError('Pick an order')
      return
    }
    if (!editor.paidToAccountId) {
      setError('Pick paid-to account')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/finance/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: editor.orderId,
          paidToAccountId: editor.paidToAccountId,
          lines: parsedLines,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Save failed')
        return
      }
      setRows((rs) => {
        const rest = rs.filter((r) => r.orderId !== json.orderId)
        return [json, ...rest]
      })
      if (json.lines) {
        setEditor((prev) => ({
          ...prev,
          revision: prev.revision + 1,
          amounts: amountsFromLines(json.lines),
          paidToAccountId: json.paidToAccountId ?? prev.paidToAccountId,
        }))
      }
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  function renderOrderList() {
    if (editor.orderId) return null
    return (
      <>
        {listOrders.length > 0 && (
          <div className="order-sheet-hits" style={{ marginTop: 12 }}>
            <div className="order-sheet-hits__label">{listLabel}</div>
            {listOrders.map((h) => (
              <Link key={h.id} href={orderHref(h.id)} className="order-sheet-hit" prefetch={false}>
                <span className="order-sheet-hit__name" title={h.id}>
                  {shortFinanceId(h.id)}
                </span>
                <span className="order-sheet-hit__meta">
                  {h.contactName ? `${h.contactName} · ` : ''}
                  {h.status} · {inr(h.grandTotal)}
                  {h.hasSheet ? ' · sheet exists' : ''}
                </span>
              </Link>
            ))}
            <div className="order-sheet-hits__footer">
              <span>Can&apos;t find the order?</span>
              <Link href="/admin/orders/new">+ Create new order</Link>
            </div>
          </div>
        )}

        {searchHint && (
          <p className="order-sheet-search-hint" role="status">
            {searchHint}
          </p>
        )}

        {searching && hits.length === 0 && (
          <div className="order-sheet-hits__empty" style={{ marginTop: 12 }}>
            <span>{searchHint || 'No matching orders found'}</span>
            <Link href={ORDERS_PATH} className="admin-btn" style={{ fontSize: '0.7rem', textDecoration: 'none' }}>
              Clear search
            </Link>
          </div>
        )}

        {!searching && recentOrders.length === 0 && (
          <div className="order-sheet-hits__empty" style={{ marginTop: 12 }}>
            <span>No orders yet.</span>
            <Link href="/admin/orders/new" className="admin-btn" style={{ fontSize: '0.7rem', textDecoration: 'none' }}>
              + Create order
            </Link>
          </div>
        )}
      </>
    )
  }

  function renderPriceInputs(kind: FinanceLineKind) {
    return (
      <>
        <label className="order-sheet-row__field">
          <span className="order-sheet-field-label-mobile">Purchase</span>
          <input
            style={{
              ...control,
              fontSize: '16px',
              ...(locked ? { background: '#f3f4f6', color: '#9ca3af' } : null),
            }}
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={editor.amounts[kind].costPrice}
            onChange={(e) => setAmount(kind, 'costPrice', e.target.value)}
            readOnly={locked}
          />
        </label>
        <label className="order-sheet-row__field">
          <span className="order-sheet-field-label-mobile">Selling</span>
          <input
            style={{
              ...control,
              fontSize: '16px',
              ...(locked ? { background: '#f3f4f6', color: '#9ca3af' } : null),
            }}
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={editor.amounts[kind].sellingPrice}
            onChange={(e) => setAmount(kind, 'sellingPrice', e.target.value)}
            readOnly={locked}
          />
        </label>
      </>
    )
  }

  return (
    <div>
      <div className="order-sheet-form" style={{ marginBottom: 12 }}>
        <div className="order-sheet-form__intro">
          <h2 className="order-sheet-form__title">Order finance sheet</h2>
          <p className="order-sheet-form__hint">
            One sheet per order. Enter purchase and selling prices by line. Leave blank if not
            applicable (counts as ₹0). Saving overwrites.
          </p>
          {error && (
            <p style={{ color: '#b91c1c', fontSize: '0.8125rem', margin: '0 0 8px' }} role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="order-sheet-editor">
          <section className="order-sheet-panel">
            <h3 className="order-sheet-panel__heading">Find order</h3>
            {!editor.orderId && (
              <div className="order-sheet-field">
                <span id="order-sheet-search-label">Search (name, phone, email, id)</span>
                <form
                  className="order-sheet-search-row"
                  method="get"
                  action={ORDERS_PATH}
                  onSubmit={onSearchSubmit}
                >
                  <input
                    ref={searchInputRef}
                    id="order-sheet-search-input"
                    name="q"
                    aria-labelledby="order-sheet-search-label"
                    className="order-sheet-search-input"
                    style={{ ...control, flex: 1, fontSize: '16px' }}
                    placeholder="Name, phone, email or order ID…"
                    defaultValue={initialSearchQuery ?? ''}
                    onChange={(e) => onSearchTyping(e.target.value)}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    enterKeyHint="search"
                    inputMode="text"
                  />
                  <button type="submit" className="order-sheet-search-btn">
                    Search
                  </button>
                </form>
                <p className="order-sheet-search-mobile-hint order-sheet-mobile-only">
                  Type at least 2 characters, then tap Search.
                </p>
                {searching && (
                  <p className="order-sheet-search-hint order-sheet-mobile-only">
                    <Link href={ORDERS_PATH}>Clear search</Link>
                    {searchHint ? ` · ${searchHint}` : ''}
                  </p>
                )}
                <Link href="/admin/orders/new" className="order-sheet-create-link">
                  + Create order
                </Link>
              </div>
            )}

            {renderOrderList()}

            {editor.orderId && (
              <div className="order-sheet-selected">
                <div>
                  <div className="order-sheet-selected__name" title={editor.orderId}>
                    {shortFinanceId(editor.orderId)}
                  </div>
                  <div className="order-sheet-selected__meta">
                    {editor.orderMeta.status ? `${editor.orderMeta.status} · ` : ''}
                    {editor.orderMeta.total != null ? `Goods ${inr(editor.orderMeta.total)}` : ''}
                    {editor.orderMeta.phone ? ` · ${editor.orderMeta.phone}` : ''}
                  </div>
                  {quotes.length > 0 && (
                    <div className="order-sheet-selected__quotes-summary">
                      {quotes.length} item{quotes.length === 1 ? '' : 's'} · Quoted Σ{' '}
                      {inr(quotes.reduce((s, q) => s + q.quotedTotal, 0))}
                    </div>
                  )}
                </div>
                <Link href={ORDERS_PATH} className="order-sheet-selected__change">
                  Change
                </Link>
              </div>
            )}
          </section>

          <section className="order-sheet-panel">
            <h3 className="order-sheet-panel__heading">Purchase &amp; selling prices</h3>

            {!editor.orderId && (
              <p style={{ fontSize: '0.8125rem', color: MUTED, marginTop: 0 }}>
                Select an order to load quoted prices and edit the sheet.
              </p>
            )}

            {editor.orderId && quotes.length === 0 && (
              <p style={{ fontSize: '0.8125rem', color: MUTED, marginTop: 0 }}>
                No line items on this order — quoted amounts unavailable. You can still enter
                purchase and selling prices.
              </p>
            )}

            {editor.orderId && (
              <form onSubmit={save}>
                {/* Desktop grid */}
                <div className="order-sheet-lines-scroll order-sheet-desk">
                  <div className="order-sheet-lines-head" style={linesGridStyle} aria-hidden>
                    <span>Line</span>
                    {quotes.map((q) => (
                      <span key={q.orderItemId} title={`${q.productName} ×${q.quantity}`}>
                        Quoted
                        <span className="order-sheet-quote-sub">
                          {q.productName.length > 18 ? `${q.productName.slice(0, 16)}…` : q.productName}
                          {q.quantity > 1 ? ` ×${q.quantity}` : ''}
                        </span>
                      </span>
                    ))}
                    <span>Purchase price (₹)</span>
                    <span>Selling price (₹)</span>
                  </div>

                  <div className="order-sheet-lines" key={`desk-${editor.revision}-${editor.orderId}`}>
                    {FINANCE_LINE_KINDS.map((kind) => (
                      <div key={kind} className="order-sheet-row" style={linesGridStyle}>
                        <div className="order-sheet-row__kind">{LINE_KIND_LABEL[kind]}</div>
                        {quotes.map((q) => (
                          <div key={q.orderItemId} className="order-sheet-row__quote">
                            <div className="order-sheet-quote-value">{inr(q.byKind[kind] ?? 0)}</div>
                          </div>
                        ))}
                        {renderPriceInputs(kind)}
                      </div>
                    ))}
                  </div>

                  <div className="order-sheet-totals" style={linesGridStyle}>
                    <div className="order-sheet-totals__cell order-sheet-totals__profit">
                      <span className="order-sheet-totals__label">Profit</span>
                      <strong>{inr(totals.profit)}</strong>
                    </div>
                    {quotes.map((q) => (
                      <div key={q.orderItemId} className="order-sheet-totals__cell">
                        <span className="order-sheet-totals__label">Quoted Σ</span>
                        <strong>{inr(q.quotedTotal)}</strong>
                      </div>
                    ))}
                    <div className="order-sheet-totals__cell">
                      <span className="order-sheet-totals__label">Purchasing</span>
                      <strong>{inr(totals.cost)}</strong>
                    </div>
                    <div className="order-sheet-totals__cell">
                      <span className="order-sheet-totals__label">Selling</span>
                      <strong>{inr(totals.selling)}</strong>
                    </div>
                  </div>
                </div>

                {/* Mobile stacked — always flex on small screens via CSS */}
                <div className="order-sheet-mobile-stack" key={`mob-${editor.revision}-${editor.orderId}`}>
                  {FINANCE_LINE_KINDS.map((kind) => (
                    <div key={kind} className="order-sheet-m-card">
                      <div className="order-sheet-m-card__kind">{LINE_KIND_LABEL[kind]}</div>
                      {quotes.map((q) => (
                        <div key={q.orderItemId} className="order-sheet-m-card__quote">
                          <span>
                            Quoted
                            {quotes.length > 1
                              ? ` · ${
                                  q.productName.length > 22
                                    ? `${q.productName.slice(0, 20)}…`
                                    : q.productName
                                }`
                              : ''}
                            {q.quantity > 1 ? ` ×${q.quantity}` : ''}
                          </span>
                          <strong>{inr(q.byKind[kind] ?? 0)}</strong>
                        </div>
                      ))}
                      {quotes.length === 0 && (
                        <div className="order-sheet-m-card__quote order-sheet-m-card__quote--empty">
                          <span>Quoted</span>
                          <strong>—</strong>
                        </div>
                      )}
                      <div className="order-sheet-m-card__fields">{renderPriceInputs(kind)}</div>
                    </div>
                  ))}

                  <div className="order-sheet-m-totals">
                    <div className="order-sheet-m-totals__profit">
                      <span>Profit</span>
                      <strong>{inr(totals.profit)}</strong>
                    </div>
                    {quotes.map((q) => (
                      <div key={q.orderItemId}>
                        <span>
                          Quoted Σ
                          {quotes.length > 1
                            ? ` · ${
                                q.productName.length > 16
                                  ? `${q.productName.slice(0, 14)}…`
                                  : q.productName
                              }`
                            : ''}
                        </span>
                        <strong>{inr(q.quotedTotal)}</strong>
                      </div>
                    ))}
                    <div>
                      <span>Purchasing</span>
                      <strong>{inr(totals.cost)}</strong>
                    </div>
                    <div>
                      <span>Selling</span>
                      <strong>{inr(totals.selling)}</strong>
                    </div>
                  </div>
                </div>

                <label className="order-sheet-field" style={{ marginTop: 14 }}>
                  <span>Customer paid to (account holding cash)</span>
                  <select
                    style={{
                      ...control,
                      fontSize: '16px',
                      ...(locked ? { background: '#f3f4f6', color: '#9ca3af' } : null),
                    }}
                    value={editor.paidToAccountId}
                    onChange={(e) =>
                      setEditor((prev) => ({ ...prev, paidToAccountId: e.target.value }))
                    }
                    required
                    disabled={locked}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="order-sheet-actions">
                  <Link href={ORDERS_PATH} className="order-sheet-btn-ghost">
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    className="admin-btn"
                    disabled={saving || !editor.orderId || !editor.paidToAccountId}
                  >
                    {saving ? 'Saving…' : 'Save sheet'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>

      <div className="order-sheet-table-wrap">
        <table className="order-sheet-table">
          <thead>
            <tr>
              <th>Order</th>
              <th style={{ textAlign: 'right' }}>Purchasing price (from vendor)</th>
              <th style={{ textAlign: 'right' }}>Selling price (to customer)</th>
              <th style={{ textAlign: 'right' }}>Profit</th>
              <th>Paid to</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: MUTED, textAlign: 'center' }}>
                  No order sheets yet.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const t = sheetTotals(
                (r.lines ?? []).map((l) => ({
                  kind: l.kind as FinanceLineKind,
                  costPrice: Number(l.costPrice) || 0,
                  sellingPrice: Number(l.sellingPrice) || 0,
                })),
              )
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/orders/${r.orderId}`} style={{ color: GREEN, fontWeight: 500 }} title={r.orderId}>
                      {shortFinanceId(r.orderId)}
                    </Link>
                  </td>
                  <td style={{ textAlign: 'right' }}>{inr(t.cost)}</td>
                  <td style={{ textAlign: 'right' }}>{inr(t.selling)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{inr(t.profit)}</td>
                  <td>{r.paidToAccountName ?? r.paidToAccountId}</td>
                  <td>
                    <Link href={orderHref(r.orderId)} className="order-sheet-btn-ghost" prefetch={false}>
                      Edit
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
