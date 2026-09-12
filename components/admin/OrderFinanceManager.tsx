'use client'

import { useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import Link from 'next/link'
import { saveOrderSheetAction } from '@/app/(admin)/admin/finance/orders/actions'
import { OrderSheetSaveButton } from '@/components/admin/OrderSheetSaveButton'
import {
  FINANCE_LINE_KINDS,
  LINE_KIND_LABEL,
  sheetTotals,
  shortFinanceId,
  sumSellingByKind,
  type OrderItemQuote,
} from '@/lib/finance'
import type { FinanceOrderHit } from '@/lib/finance-order-search'
import { SETTLEMENT_LABEL, type SettlementStatus } from '@/lib/finance-settlement'
import { ORDER_STATUS_META } from '@/lib/orders'
import type { FinanceLineKind, OrderStatus } from '@prisma/client'

type Line = {
  id?: string
  kind: FinanceLineKind | string
  costPrice: number
  sellingPrice: number
}

type Hit = FinanceOrderHit

function statusLabel(status: string): string {
  return ORDER_STATUS_META[status as OrderStatus]?.label ?? status
}

type AccountOpt = { id: string; name: string }

type Amounts = Record<FinanceLineKind, { costPrice: string; sellingPrice: string }>

type Editor = {
  revision: number
  orderId: string
  orderLabel: string
  orderMeta: { phone?: string; total?: number; status?: string; itemsLabel?: string }
  amounts: Amounts
  paidToAccountId: string
  hasSheet: boolean
  roundOffEnabled: boolean
}

/** Server-prefetched selection — avoids mobile client-fetch races. */
export type OrderSheetBoot = {
  orderId: string
  orderLabel: string
  orderMeta: { phone?: string; total?: number; status?: string; itemsLabel?: string }
  paidToAccountId: string
  lines: Line[]
  quotes: OrderItemQuote[]
  hasSheet?: boolean
  roundOffEnabled?: boolean
}

type SheetFilter = 'all' | 'incomplete' | 'complete'

const GREEN = '#032b24'
const BORDER = '#e5e7eb'
const MUTED = '#6b7280'

function paymentStatusStyle(s: SettlementStatus): CSSProperties {
  const map: Record<SettlementStatus, { bg: string; color: string }> = {
    unpaid: { bg: '#fef2f2', color: '#b91c1c' },
    partial: { bg: '#fffbeb', color: '#b45309' },
    settled: { bg: '#dceee8', color: GREEN },
    overpaid: { bg: '#eff6ff', color: '#1d4ed8' },
  }
  const m = map[s]
  return {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 600,
    background: m.bg,
    color: m.color,
  }
}
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
    GST: { costPrice: '', sellingPrice: '' },
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
    const summed = sumSellingByKind(boot.quotes)
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

/** Deterministic Indian grouping — avoids SSR/client toLocaleString hydration mismatches. */
function inr(n: number): string {
  const rounded = Math.round(n * 100) / 100
  const sign = rounded < 0 ? '-' : ''
  const [intDigits, fracRaw] = Math.abs(rounded).toFixed(2).split('.')
  let grouped = intDigits
  if (intDigits.length > 3) {
    const last3 = intDigits.slice(-3)
    let rest = intDigits.slice(0, -3)
    const parts: string[] = []
    while (rest.length > 2) {
      parts.unshift(rest.slice(-2))
      rest = rest.slice(0, -2)
    }
    if (rest) parts.unshift(rest)
    grouped = `${parts.join(',')},${last3}`
  }
  const frac = (fracRaw ?? '').replace(/0+$/, '')
  return frac ? `₹${sign}${grouped}.${frac}` : `₹${sign}${grouped}`
}

function moneyOrDash(n: number | null | undefined): string {
  if (n == null) return '—'
  return inr(n)
}

/** Profit as % of selling price. */
function profitPct(profit: number | null | undefined, selling: number | null | undefined): number | null {
  if (profit == null || selling == null || selling <= 0.0001) return null
  return Math.round((profit / selling) * 1000) / 10
}

function pctOrDash(n: number | null | undefined): string {
  if (n == null) return '—'
  const rounded = Math.round(n * 10) / 10
  const s = Number.isInteger(rounded) ? String(rounded) : String(rounded)
  return `${s}%`
}

function orderHref(orderId: string) {
  return `${ORDERS_PATH}?orderId=${encodeURIComponent(orderId)}`
}

function filterHref(filter: SheetFilter, q?: string) {
  const params = new URLSearchParams()
  if (filter !== 'all') params.set('filter', filter)
  if (q && q.trim().length >= 2) params.set('q', q.trim())
  const s = params.toString()
  return s ? `${ORDERS_PATH}?${s}` : ORDERS_PATH
}

/** Match admin-shell.css order-sheet breakpoints (max-width: 767px). */
function useIsNarrowOrderSheet() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia('(max-width: 767px)')
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(max-width: 767px)').matches,
    () => true,
  )
}

export function OrderFinanceManager({
  accounts,
  defaultPaidToAccountId,
  recentOrders = [],
  selectedOrderId = null,
  boot = null,
  initialSearchQuery = null,
  initialSearchHits = null,
  initialSaveFlash = false,
  initialSaveError = null,
  initialFilter = 'all',
}: {
  accounts: AccountOpt[]
  defaultPaidToAccountId: string | null
  recentOrders?: Hit[]
  selectedOrderId?: string | null
  boot?: OrderSheetBoot | null
  initialSearchQuery?: string | null
  initialSearchHits?: Hit[] | null
  initialSaveFlash?: boolean
  initialSaveError?: string | null
  initialFilter?: SheetFilter
}) {
  const fallbackPaidTo = defaultPaidToAccountId ?? accounts[0]?.id ?? ''

  const [query, setQuery] = useState(() => initialSearchQuery ?? '')
  const [hits, setHits] = useState<Hit[]>(() => initialSearchHits ?? [])
  const [searching, setSearching] = useState(() => Boolean(initialSearchQuery))
  const [searchHint, setSearchHint] = useState(() => {
    if (!initialSearchQuery) return ''
    const n = initialSearchHits?.length ?? 0
    return n === 0 ? 'No matching orders found' : `${n} result${n === 1 ? '' : 's'}`
  })
  const [filter, setFilter] = useState<SheetFilter>(initialFilter)
  const [editor, setEditor] = useState<Editor>(() =>
    boot
      ? {
          revision: 1,
          orderId: boot.orderId,
          orderLabel: boot.orderLabel,
          orderMeta: boot.orderMeta,
          amounts: amountsFromBoot(boot),
          paidToAccountId: boot.paidToAccountId || fallbackPaidTo,
          hasSheet: boot.hasSheet ?? boot.lines.length > 0,
          roundOffEnabled: Boolean(boot.roundOffEnabled),
        }
      : {
          revision: 0,
          orderId: '',
          orderLabel: '',
          orderMeta: {},
          amounts: emptyAmounts(),
          paidToAccountId: fallbackPaidTo,
          hasSheet: false,
          roundOffEnabled: false,
        },
  )
  const [quotes] = useState<OrderItemQuote[]>(() => boot?.quotes ?? [])
  const [error] = useState(() => {
    if (initialSaveError) return initialSaveError
    if (selectedOrderId && !boot) return 'Order not found'
    return ''
  })
  const searchSeq = useRef(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isNarrow = useIsNarrowOrderSheet()
  const saveStatus = initialSaveError ? '' : initialSaveFlash ? 'Saved' : ''

  const parsedLines = parseAmounts(editor.amounts)
  const totals = sheetTotals(parsedLines, { roundOffEnabled: editor.roundOffEnabled })
  const baseList = searching && (hits.length > 0 || Boolean(initialSearchQuery)) ? hits : recentOrders
  const listOrders = useMemo(() => {
    if (filter === 'incomplete') return baseList.filter((h) => !h.sheetComplete)
    if (filter === 'complete') return baseList.filter((h) => h.sheetComplete)
    return baseList
  }, [baseList, filter])

  const listTotals = useMemo(() => {
    let selling = 0
    let collected = 0
    let purchasing = 0
    let profit = 0
    let amount = 0
    for (const h of listOrders) {
      amount += h.grandTotal || 0
      collected += h.collected || 0
      if (h.selling != null) selling += h.selling
      if (h.purchasing != null) purchasing += h.purchasing
      if (h.profit != null) profit += h.profit
    }
    return {
      amount,
      selling,
      collected,
      purchasing,
      profit,
      profitPct: profitPct(profit, selling),
    }
  }, [listOrders])

  const quoteCols = quotes.length
  const linesGridStyle: CSSProperties = {
    gridTemplateColumns:
      quoteCols > 0
        ? `minmax(96px, 0.9fr) ${'minmax(72px, 0.85fr) '.repeat(quoteCols)}minmax(88px, 1fr) minmax(88px, 1fr)`
        : 'minmax(96px, 0.9fr) minmax(88px, 1fr) minmax(88px, 1fr)',
  }
  const locked = !editor.orderId
  const incompleteCount = baseList.filter((h) => !h.sheetComplete).length
  const completeCount = baseList.filter((h) => h.sheetComplete).length

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
      setHits(next)
      setSearchHint(next.length === 0 ? 'No matching orders found' : `${next.length} result${next.length === 1 ? '' : 's'}`)
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

  function onSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const typed = (searchInputRef.current?.value ?? '').trim()
    if (typed.length < 2) {
      setSearchHint('Type at least 2 characters, then tap Search')
      return
    }
    void fetchHits(typed)
  }

  function renderPriceInputs(kind: FinanceLineKind, surface: 'desk' | 'mobile') {
    const active = surface === 'mobile' ? isNarrow : !isNarrow
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
            name={active ? `cost_${kind}` : undefined}
            inputMode="decimal"
            placeholder="0"
            value={editor.amounts[kind].costPrice}
            onChange={(e) => setAmount(kind, 'costPrice', e.target.value)}
            readOnly={locked}
            disabled={locked || !active}
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
            name={active ? `sell_${kind}` : undefined}
            inputMode="decimal"
            placeholder="0"
            value={editor.amounts[kind].sellingPrice}
            onChange={(e) => setAmount(kind, 'sellingPrice', e.target.value)}
            readOnly={locked}
            disabled={locked || !active}
          />
        </label>
      </>
    )
  }

  function renderSaveBar() {
    const status = error || saveStatus || '\u00a0'
    return (
      <div className="order-sheet-save-bar">
        <p
          className="order-sheet-save-bar__status"
          style={{ color: error ? '#b91c1c' : '#065f46' }}
          role="status"
          aria-live="polite"
        >
          {status}
        </p>
        <div className="order-sheet-actions">
          <Link href={ORDERS_PATH} className="order-sheet-btn-ghost">
            Cancel
          </Link>
          <OrderSheetSaveButton />
        </div>
      </div>
    )
  }

  function actionLabel(h: Hit) {
    return h.hasSheet ? 'Edit' : 'Add sheet'
  }

  function renderFilterChips() {
    const chips: { id: SheetFilter; label: string; count?: number }[] = [
      { id: 'all', label: 'All', count: baseList.length },
      { id: 'incomplete', label: 'Incomplete', count: incompleteCount },
      { id: 'complete', label: 'Complete', count: completeCount },
    ]
    return (
      <div className="order-sheet-filters" role="tablist" aria-label="Sheet status">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={filter === c.id}
            className={`order-sheet-filter-chip${filter === c.id ? ' is-active' : ''}`}
            onClick={() => setFilter(c.id)}
          >
            {c.label}
            {c.count != null ? <span className="order-sheet-filter-chip__count">{c.count}</span> : null}
          </button>
        ))}
      </div>
    )
  }

  function renderListDesk() {
    return (
      <div className="order-sheet-hits order-sheet-desk">
        <div className="order-sheet-hits__table-wrap">
          <table className="order-sheet-hits__table order-sheet-hits__table--wide">
            <colgroup>
              <col className="order-sheet-hits__col-contact" />
              <col className="order-sheet-hits__col-item" />
              <col className="order-sheet-hits__col-num" />
              <col className="order-sheet-hits__col-num" />
              <col className="order-sheet-hits__col-num" />
              <col className="order-sheet-hits__col-pct" />
              <col className="order-sheet-hits__col-num" />
              <col className="order-sheet-hits__col-payment" />
              <col className="order-sheet-hits__col-paidto" />
              <col className="order-sheet-hits__col-id" />
              <col className="order-sheet-hits__col-action" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Contact</th>
                <th scope="col">Item</th>
                <th scope="col" className="order-sheet-hits__num">
                  Selling price
                </th>
                <th scope="col" className="order-sheet-hits__num">
                  Purchase price
                </th>
                <th scope="col" className="order-sheet-hits__num">
                  Profit
                </th>
                <th scope="col" className="order-sheet-hits__num">
                  Profit %
                </th>
                <th scope="col" className="order-sheet-hits__num">
                  Collected
                </th>
                <th scope="col">Payment status</th>
                <th scope="col">Paid to</th>
                <th scope="col">Order ID</th>
                <th scope="col" />
              </tr>
              {listOrders.length > 0 ? (
                <tr className="order-sheet-hits__totals">
                  <th scope="row" colSpan={2}>
                    Totals · {listOrders.length} order{listOrders.length === 1 ? '' : 's'}
                  </th>
                  <th className="order-sheet-hits__num">{inr(listTotals.selling)}</th>
                  <th className="order-sheet-hits__num">{inr(listTotals.purchasing)}</th>
                  <th className="order-sheet-hits__num order-sheet-hits__num--strong">
                    {inr(listTotals.profit)}
                  </th>
                  <th className="order-sheet-hits__num order-sheet-hits__num--strong">
                    {pctOrDash(listTotals.profitPct)}
                  </th>
                  <th className="order-sheet-hits__num">{inr(listTotals.collected)}</th>
                  <th colSpan={3} />
                  <th />
                </tr>
              ) : null}
            </thead>
            <tbody>
              {listOrders.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: 16, color: MUTED, textAlign: 'center' }}>
                    {searching ? 'No matching orders' : 'No orders in this filter'}
                  </td>
                </tr>
              )}
              {listOrders.map((h) => (
                <tr key={h.id} className={!h.sheetComplete ? 'is-incomplete' : undefined}>
                  <td>
                    <Link href={orderHref(h.id)} className="order-sheet-hits__link" prefetch={false}>
                      <span className="order-sheet-hits__contact">{h.contactName || '—'}</span>
                      {h.contactPhone ? (
                        <span className="order-sheet-hits__sub">{h.contactPhone}</span>
                      ) : null}
                    </Link>
                  </td>
                  <td>
                    <Link
                      href={orderHref(h.id)}
                      className="order-sheet-hits__link"
                      prefetch={false}
                      title={h.itemsLabel}
                    >
                      {h.itemsLabel || '—'}
                    </Link>
                  </td>
                  <td className="order-sheet-hits__num">{moneyOrDash(h.selling)}</td>
                  <td className="order-sheet-hits__num">{moneyOrDash(h.purchasing)}</td>
                  <td className="order-sheet-hits__num order-sheet-hits__num--strong">
                    {moneyOrDash(h.profit)}
                  </td>
                  <td className="order-sheet-hits__num order-sheet-hits__num--strong">
                    {pctOrDash(profitPct(h.profit, h.selling))}
                  </td>
                  <td className="order-sheet-hits__num">{inr(h.collected)}</td>
                  <td>
                    <span
                      title={`Expected ${inr(h.expected)} · balance ${inr(h.balance)}`}
                      style={paymentStatusStyle(h.paymentStatus)}
                    >
                      {SETTLEMENT_LABEL[h.paymentStatus]}
                    </span>
                  </td>
                  <td>{h.paidToAccountName || '—'}</td>
                  <td>
                    <Link
                      href={orderHref(h.id)}
                      className="order-sheet-hits__link order-sheet-hits__id"
                      prefetch={false}
                      title={h.id}
                    >
                      {shortFinanceId(h.id)}
                    </Link>
                  </td>
                  <td>
                    <Link
                      href={orderHref(h.id)}
                      className={
                        h.hasSheet ? 'order-sheet-row-action' : 'order-sheet-row-action is-add'
                      }
                      prefetch={false}
                    >
                      {actionLabel(h)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="order-sheet-hits__footer">
          <span>
            {listOrders.length} order{listOrders.length === 1 ? '' : 's'}
            {searching ? '' : ' shown'}
          </span>
          <Link href="/admin/orders/new">+ Create new order</Link>
        </div>
      </div>
    )
  }

  function renderListMobile() {
    return (
      <div className="order-sheet-mobile-list order-sheet-mobile-stack">
        {listOrders.length === 0 && (
          <p style={{ fontSize: '0.8125rem', color: MUTED, margin: '8px 0' }}>
            {searching ? 'No matching orders' : 'No orders in this filter'}
          </p>
        )}
        {listOrders.map((h) => (
          <article
            key={h.id}
            className={`order-sheet-list-card${!h.sheetComplete ? ' is-incomplete' : ''}`}
          >
            <div className="order-sheet-list-card__top">
              <div>
                <div className="order-sheet-list-card__name">{h.contactName || '—'}</div>
                {h.contactPhone ? (
                  <div className="order-sheet-list-card__sub">{h.contactPhone}</div>
                ) : null}
                <div className="order-sheet-list-card__sub" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  <span
                    title={`Expected ${inr(h.expected)} · balance ${inr(h.balance)}`}
                    style={paymentStatusStyle(h.paymentStatus)}
                  >
                    {SETTLEMENT_LABEL[h.paymentStatus]}
                  </span>
                  <span>collected {inr(h.collected)}</span>
                </div>
              </div>
              <span
                className={`order-sheet-hits__pill ${h.sheetComplete ? 'is-yes' : 'is-no'}`}
              >
                {h.sheetComplete ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="order-sheet-list-card__item">{h.itemsLabel || '—'}</div>
            <div className="order-sheet-list-card__meta">
              <span className="order-sheet-hits__amount">{inr(h.grandTotal)}</span>
              <span title={h.id}>{shortFinanceId(h.id)}</span>
              <span>{statusLabel(h.status)}</span>
            </div>
            <div className="order-sheet-list-card__money">
              <div>
                <span>Selling</span>
                <strong>{moneyOrDash(h.selling)}</strong>
              </div>
              <div>
                <span>Paid to</span>
                <strong>{h.paidToAccountName || '—'}</strong>
              </div>
              <div>
                <span>Purchasing</span>
                <strong>{moneyOrDash(h.purchasing)}</strong>
              </div>
              <div>
                <span>Profit</span>
                <strong>{moneyOrDash(h.profit)}</strong>
              </div>
              <div>
                <span>Profit %</span>
                <strong>{pctOrDash(profitPct(h.profit, h.selling))}</strong>
              </div>
            </div>
            <Link
              href={orderHref(h.id)}
              className={
                h.hasSheet
                  ? 'order-sheet-list-card__cta'
                  : 'order-sheet-list-card__cta is-add'
              }
              prefetch={false}
            >
              {actionLabel(h)}
            </Link>
          </article>
        ))}
        <div className="order-sheet-hits__footer" style={{ marginTop: 4 }}>
          <span>Can&apos;t find the order?</span>
          <Link href="/admin/orders/new">+ Create new order</Link>
        </div>
      </div>
    )
  }

  if (editor.orderId) {
    return (
      <div className="order-sheet-edit-page">
        <Link href={filterHref(filter, query)} className="order-sheet-back">
          ← All order sheets
        </Link>
        <div className="order-sheet-form__intro">
          <h2 className="order-sheet-form__title">
            {editor.hasSheet ? 'Edit order sheet' : 'Add order sheet'}
          </h2>
          <p className="order-sheet-form__hint">
            Enter purchase and selling prices by line. Leave blank if not applicable (counts as ₹0).
            Saving overwrites.
          </p>
          <details className="order-sheet-col-guide">
            <summary className="order-sheet-col-guide__summary">
              <span>How Quoted, Purchase &amp; Selling work</span>
              <span aria-hidden className="order-sheet-col-guide__chevron">
                ▾
              </span>
            </summary>
            <div className="order-sheet-col-guide__body">
              <ul>
                <li>
                  <strong>Quoted</strong> — reference only (not saved). Live catalogue prices for
                  each line, except <strong>Gold</strong>, which uses the gold value frozen on the
                  order at checkout.
                </li>
                <li>
                  <strong>Purchase price</strong> — what you paid the vendor for that line. Enter
                  ₹0 / leave blank if not applicable. A sheet is complete when every line with a
                  selling price also has a non-zero purchase price.
                </li>
                <li>
                  <strong>Selling price</strong> — what the customer paid for that line. Prefills
                  from the order&apos;s checkout price breakdown (gold, diamonds, making, wastage,
                  delivery, GST). Edit before saving if needed.
                </li>
              </ul>
              <p>
                Profit on the sheet = sum of selling − sum of purchase. Blank fields count as ₹0.
              </p>
            </div>
          </details>
          {error && (
            <p style={{ color: '#b91c1c', fontSize: '0.8125rem', margin: '0 0 8px' }} role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="order-sheet-editor">
          <section className="order-sheet-panel">
            <div className="order-sheet-selected">
              <div>
                <div className="order-sheet-selected__name" title={editor.orderId}>
                  {editor.orderLabel || shortFinanceId(editor.orderId)}
                  <span className="order-sheet-selected__id" title={editor.orderId}>
                    {' '}
                    · {shortFinanceId(editor.orderId)}
                  </span>
                </div>
                <div className="order-sheet-selected__meta">
                  {editor.orderMeta.status ? `${statusLabel(editor.orderMeta.status)} · ` : ''}
                  {editor.orderMeta.total != null ? `Goods ${inr(editor.orderMeta.total)}` : ''}
                  {editor.orderMeta.phone ? ` · ${editor.orderMeta.phone}` : ''}
                </div>
                {editor.orderMeta.itemsLabel ? (
                  <div className="order-sheet-selected__quotes-summary">
                    {editor.orderMeta.itemsLabel}
                  </div>
                ) : null}
                {quotes.length > 0 && (
                  <div className="order-sheet-selected__quotes-summary">
                    {quotes.length} item{quotes.length === 1 ? '' : 's'} · Quoted Σ{' '}
                    {inr(quotes.reduce((s, q) => s + q.quotedTotal, 0))}
                  </div>
                )}
                <Link
                  href={`/admin/orders/${editor.orderId}`}
                  className="order-sheet-selected__open"
                >
                  Open order
                </Link>
              </div>
            </div>
          </section>

          <section className="order-sheet-panel">
            <h3 className="order-sheet-panel__heading">Purchase &amp; selling prices</h3>

            {quotes.length === 0 && (
              <p style={{ fontSize: '0.8125rem', color: MUTED, marginTop: 0 }}>
                No line items on this order — quoted amounts unavailable. You can still enter
                purchase and selling prices.
              </p>
            )}

            <form action={saveOrderSheetAction} className="order-sheet-sheet-form">
              <input type="hidden" name="orderId" value={editor.orderId} />

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
                  {quotes.length === 0 && <span>Quoted</span>}
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
                      {quotes.length === 0 && (
                        <div className="order-sheet-row__quote">
                          <div className="order-sheet-quote-value">—</div>
                        </div>
                      )}
                      {renderPriceInputs(kind, 'desk')}
                    </div>
                  ))}
                </div>

                <div className="order-sheet-totals" style={linesGridStyle}>
                  <div className="order-sheet-totals__cell order-sheet-totals__profit">
                    <span className="order-sheet-totals__label">Profit</span>
                    <strong>{inr(totals.profit)}</strong>
                    <span className="order-sheet-totals__sub">
                      {pctOrDash(profitPct(totals.profit, totals.selling))} of selling
                    </span>
                  </div>
                  {quotes.map((q) => (
                    <div key={q.orderItemId} className="order-sheet-totals__cell">
                      <span className="order-sheet-totals__label">Quoted Σ</span>
                      <strong>{inr(q.quotedTotal)}</strong>
                    </div>
                  ))}
                  {quotes.length === 0 && <div className="order-sheet-totals__cell" />}
                  <div className="order-sheet-totals__cell">
                    <span className="order-sheet-totals__label">Purchasing</span>
                    <strong>{inr(totals.cost)}</strong>
                  </div>
                  <div className="order-sheet-totals__cell">
                    <span className="order-sheet-totals__label">Selling</span>
                    <strong>{inr(totals.selling)}</strong>
                    {totals.roundOffEnabled && Math.abs(totals.roundOff) > 0.0001 ? (
                      <span className="order-sheet-totals__sub">
                        Raw {inr(totals.sellingRaw)} · Round off{' '}
                        {totals.roundOff < 0
                          ? `(${inr(Math.abs(totals.roundOff)).replace(/^₹/, '')})`
                          : inr(totals.roundOff)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

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
                    <div className="order-sheet-m-card__fields">{renderPriceInputs(kind, 'mobile')}</div>
                  </div>
                ))}

                <div className="order-sheet-m-totals">
                  <div className="order-sheet-m-totals__profit">
                    <span>Profit</span>
                    <strong>{inr(totals.profit)}</strong>
                    <span className="order-sheet-totals__sub">
                      {pctOrDash(profitPct(totals.profit, totals.selling))} of selling
                    </span>
                  </div>
                  {quotes.map((q) => (
                    <div key={q.orderItemId}>
                      <span>Quoted Σ</span>
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
                    {totals.roundOffEnabled && Math.abs(totals.roundOff) > 0.0001 ? (
                      <span className="order-sheet-totals__sub">
                        Raw {inr(totals.sellingRaw)} · Round off{' '}
                        {totals.roundOff < 0
                          ? `(${inr(Math.abs(totals.roundOff)).replace(/^₹/, '')})`
                          : inr(totals.roundOff)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <label
                className="order-sheet-roundoff"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  marginTop: 14,
                  fontSize: '0.875rem',
                  color: '#111827',
                  cursor: locked ? 'default' : 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  name="roundOffEnabled"
                  value="true"
                  checked={editor.roundOffEnabled}
                  onChange={(e) =>
                    setEditor((prev) => ({ ...prev, roundOffEnabled: e.target.checked }))
                  }
                  disabled={locked}
                  style={{ marginTop: 3, width: 16, height: 16, accentColor: GREEN }}
                />
                <span>
                  <strong style={{ fontWeight: 600 }}>Round off</strong>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: MUTED, marginTop: 2 }}>
                    Round selling total to the nearest rupee (used for expected collections).
                  </span>
                </span>
              </label>

              <label className="order-sheet-field" style={{ marginTop: 14 }}>
                <span>Customer paid to (account holding cash)</span>
                <select
                  style={{
                    ...control,
                    fontSize: '16px',
                    ...(locked ? { background: '#f3f4f6', color: '#9ca3af' } : null),
                  }}
                  name="paidToAccountId"
                  value={editor.paidToAccountId}
                  onChange={(e) =>
                    setEditor((prev) => ({ ...prev, paidToAccountId: e.target.value }))
                  }
                  disabled={locked}
                >
                  {accounts.length === 0 && <option value="">No accounts configured</option>}
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>

              {renderSaveBar()}
            </form>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="order-sheet-form" style={{ marginBottom: 12 }}>
        <div className="order-sheet-form__intro">
          <h2 className="order-sheet-form__title">Order sheets</h2>
          <p className="order-sheet-form__hint">
            One sheet per order — purchase and selling by line. Use Add sheet / Edit to open a
            sheet.
          </p>
          {error && (
            <p style={{ color: '#b91c1c', fontSize: '0.8125rem', margin: '0 0 8px' }} role="alert">
              {error}
            </p>
          )}
          {!error && saveStatus && (
            <p
              style={{ color: '#065f46', fontSize: '0.8125rem', margin: '0 0 8px', fontWeight: 600 }}
              role="status"
            >
              {saveStatus}
            </p>
          )}
        </div>

        <div className="order-sheet-list">
          <div className="order-sheet-list-pin">
            <div className="order-sheet-toolbar">
              {renderFilterChips()}
              <form className="order-sheet-search-row" onSubmit={onSearchSubmit}>
                <input
                  ref={searchInputRef}
                  id="order-sheet-search-input"
                  name="q"
                  aria-label="Search (name, phone, email, id, item)"
                  className="order-sheet-search-input"
                  style={{ ...control, flex: 1, fontSize: '16px' }}
                  placeholder="Name, phone, email, order ID or item…"
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
            </div>
            <div className="order-sheet-search-actions">
              <p className="order-sheet-search-mobile-hint order-sheet-mobile-only">
                Type at least 2 characters, then tap Search.
              </p>
              {searching ? (
                <p className="order-sheet-search-hint">
                  <button
                    type="button"
                    className="order-sheet-btn-ghost"
                    style={{ padding: 0, textDecoration: 'underline' }}
                    onClick={() => {
                      setSearching(false)
                      setHits([])
                      setQuery('')
                      setSearchHint('')
                      if (searchInputRef.current) searchInputRef.current.value = ''
                    }}
                  >
                    Clear search
                  </button>
                  {searchHint ? ` · ${searchHint}` : ''}
                </p>
              ) : null}
            </div>
            {listOrders.length > 0 ? (
              <div className="order-sheet-list-totals order-sheet-mobile-only">
                <div className="order-sheet-list-totals__title">
                  Totals · {listOrders.length} order{listOrders.length === 1 ? '' : 's'}
                </div>
                <div className="order-sheet-list-card__money">
                  <div>
                    <span>Amount</span>
                    <strong>{inr(listTotals.amount)}</strong>
                  </div>
                  <div>
                    <span>Selling</span>
                    <strong>{inr(listTotals.selling)}</strong>
                  </div>
                  <div>
                    <span>Collected</span>
                    <strong>{inr(listTotals.collected)}</strong>
                  </div>
                  <div>
                    <span>Purchasing</span>
                    <strong>{inr(listTotals.purchasing)}</strong>
                  </div>
                  <div>
                    <span>Profit</span>
                    <strong>{inr(listTotals.profit)}</strong>
                  </div>
                  <div>
                    <span>Profit %</span>
                    <strong>{pctOrDash(listTotals.profitPct)}</strong>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {renderListDesk()}
          {renderListMobile()}
        </div>
      </div>
    </div>
  )
}
