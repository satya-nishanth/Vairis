'use client'

import { useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { saveOrderSheetAction } from '@/app/(admin)/admin/finance/orders/actions'
import { OrderSheetSaveButton } from '@/components/admin/OrderSheetSaveButton'
import {
  FINANCE_LINE_KINDS,
  LINE_KIND_LABEL,
  roundMoney,
  sheetTotals,
  shortFinanceId,
  sumSellingByKind,
  type OrderItemQuote,
} from '@/lib/finance'
import type { FinanceOrderHit } from '@/lib/finance-order-search'
import type { OrderSheetPaymentRow } from '@/lib/finance-order-sheet-payments'
import { SETTLEMENT_LABEL, type SettlementStatus } from '@/lib/finance-settlement'
import { ORDER_STATUS_META } from '@/lib/orders'
import type { FinanceLineKind, OrderStatus } from '@prisma/client'
import { FinanceAccountSelectOptions, type FinanceAccountOpt } from '@/components/admin/FinanceAccountSelectOptions'

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

type Amounts = Record<FinanceLineKind, { costPrice: string; sellingPrice: string }>

type Editor = {
  revision: number
  orderId: string
  orderLabel: string
  orderMeta: {
    phone?: string
    total?: number
    status?: string
    itemsLabel?: string
    createdAt?: string
    autoDiscount?: number
    autoDiscountLabel?: string
    couponDiscount?: number
    couponDiscountLabel?: string
  }
  amounts: Amounts
  paidToAccountId: string
  purchaseFromAccountId: string
  hasSheet: boolean
  roundOffEnabled: boolean
  manuallySettled: boolean
  manuallySettledNote: string
  manuallySettledBy: string | null
  manuallySettledAt: string | null
}

/** Server-prefetched selection — avoids mobile client-fetch races. */
export type OrderSheetBoot = {
  orderId: string
  orderLabel: string
  orderMeta: {
    phone?: string
    total?: number
    status?: string
    itemsLabel?: string
    createdAt?: string
    autoDiscount?: number
    autoDiscountLabel?: string
    couponDiscount?: number
    couponDiscountLabel?: string
  }
  paidToAccountId: string
  purchaseFromAccountId: string | null
  lines: Line[]
  quotes: OrderItemQuote[]
  hasSheet?: boolean
  roundOffEnabled?: boolean
  manuallySettled?: boolean
  manuallySettledNote?: string | null
  manuallySettledBy?: string | null
  manuallySettledAt?: string | null
  paymentSummary?: {
    expected: number
    collected: number
    balance: number
    paymentStatus: SettlementStatus
    settledInCompanyBank?: number
  }
  paymentGroups?: {
    customer: { rows: OrderSheetPaymentRow[]; total: number }
    vendor: { rows: OrderSheetPaymentRow[]; total: number }
    misc: { rows: OrderSheetPaymentRow[]; total: number }
  }
}

type SheetFilter = 'all' | 'incomplete' | 'complete'

type SheetSortKey =
  | 'contact'
  | 'item'
  | 'selling'
  | 'purchasing'
  | 'profit'
  | 'profitPct'
  | 'collected'
  | 'payment'
  | 'vendor'
  | 'paidTo'
  | 'orderId'
  | 'createdAt'

type SortDir = 'asc' | 'desc'

const PAYMENT_SORT_RANK: Record<SettlementStatus, number> = {
  unpaid: 0,
  partial: 1,
  fully_paid: 2,
  settled: 3,
  overpaid: 4,
}

function cmpStr(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
}

function cmpNum(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a - b
}

function sheetSortValue(h: Hit, key: SheetSortKey): number | string | null {
  switch (key) {
    case 'contact':
      return h.contactName || ''
    case 'item':
      return h.itemsLabel || ''
    case 'selling':
      return h.selling
    case 'purchasing':
      return h.purchasing
    case 'profit':
      return h.profit
    case 'profitPct':
      return profitPct(h.profit, h.selling)
    case 'collected':
      return h.collected
    case 'payment':
      return PAYMENT_SORT_RANK[h.paymentStatus] ?? 0
    case 'vendor':
      return h.purchaseFromAccountName || ''
    case 'paidTo':
      return h.paidToAccountName || ''
    case 'orderId':
      return h.id
    case 'createdAt':
      return new Date(h.createdAt).getTime() || 0
  }
}

function compareSheetHits(a: Hit, b: Hit, key: SheetSortKey): number {
  const va = sheetSortValue(a, key)
  const vb = sheetSortValue(b, key)
  if (typeof va === 'string' && typeof vb === 'string') return cmpStr(va, vb)
  return cmpNum(va as number | null, vb as number | null)
}

const GREEN = '#032b24'
const BORDER = '#e5e7eb'
const MUTED = '#6b7280'

function paymentStatusStyle(s: SettlementStatus): CSSProperties {
  const map: Record<SettlementStatus, { bg: string; color: string }> = {
    unpaid: { bg: '#fef2f2', color: '#b91c1c' },
    partial: { bg: '#fffbeb', color: '#b45309' },
    fully_paid: { bg: '#ecfdf5', color: '#047857' },
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
    CERTIFICATION: { costPrice: '', sellingPrice: '' },
    PACKAGING: { costPrice: '', sellingPrice: '' },
    DELIVERY: { costPrice: '', sellingPrice: '' },
    MISC: { costPrice: '', sellingPrice: '' },
    GST: { costPrice: '', sellingPrice: '' },
    DISCOUNT: { costPrice: '', sellingPrice: '' },
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
  if (boot.quotes.length > 0) {
    const summed = sumSellingByKind(boot.quotes)
    const sellingEmpty = FINANCE_LINE_KINDS.every((k) => !next[k].sellingPrice)
    next = { ...next }
    for (const kind of FINANCE_LINE_KINDS) {
      // Full prefill when sheet is blank; otherwise only fill missing kinds
      // (e.g. older sheets saved before Certification / Packaging / Misc / Discount).
      if (sellingEmpty || !next[kind].sellingPrice) {
        next[kind] = {
          ...next[kind],
          sellingPrice: moneyToInput(summed[kind]),
        }
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

function formatSheetDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const day = d.getDate()
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const mon = months[d.getMonth()]
  const year = d.getFullYear()
  let h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  const mm = m < 10 ? `0${m}` : String(m)
  return `${day} ${mon} ${year}, ${h}:${mm} ${ampm}`
}

function formatPaymentDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function balanceStatusLabel(status: SettlementStatus | undefined, balance: number): string {
  if (!status) return '—'
  if (status === 'settled') return 'Settled'
  if (status === 'fully_paid') return 'Fully Paid'
  if (status === 'overpaid') return 'Overpaid'
  if (status === 'partial') return `Balance ${inr(Math.max(0, balance))} due`
  return SETTLEMENT_LABEL[status]
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
  vendorAccounts,
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
  accounts: FinanceAccountOpt[]
  vendorAccounts: FinanceAccountOpt[]
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
  const [customerFilter, setCustomerFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<'all' | SettlementStatus>('all')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [paidToFilter, setPaidToFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SheetSortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [editor, setEditor] = useState<Editor>(() =>
    boot
      ? {
          revision: 1,
          orderId: boot.orderId,
          orderLabel: boot.orderLabel,
          orderMeta: boot.orderMeta,
          amounts: amountsFromBoot(boot),
          paidToAccountId: boot.paidToAccountId || fallbackPaidTo,
          purchaseFromAccountId: boot.purchaseFromAccountId ?? '',
          hasSheet: boot.hasSheet ?? boot.lines.length > 0,
          roundOffEnabled: boot.roundOffEnabled ?? true,
          manuallySettled: Boolean(boot.manuallySettled),
          manuallySettledNote: boot.manuallySettledNote ?? '',
          manuallySettledBy: boot.manuallySettledBy ?? null,
          manuallySettledAt: boot.manuallySettledAt ?? null,
        }
      : {
          revision: 0,
          orderId: '',
          orderLabel: '',
          orderMeta: {},
          amounts: emptyAmounts(),
          paidToAccountId: fallbackPaidTo,
          purchaseFromAccountId: '',
          hasSheet: false,
          roundOffEnabled: true,
          manuallySettled: false,
          manuallySettledNote: '',
          manuallySettledBy: null,
          manuallySettledAt: null,
        },
  )
  const [settleNote, setSettleNote] = useState(() => boot?.manuallySettledNote ?? '')
  const [settleBusy, setSettleBusy] = useState(false)
  const [settleError, setSettleError] = useState('')
  const [settleStatus, setSettleStatus] = useState('')
  const [openSection, setOpenSection] = useState<{
    prices: boolean
    customer: boolean
    vendor: boolean
    misc: boolean
  }>(() => ({
    prices: true,
    customer: false,
    vendor: false,
    misc: (boot?.paymentGroups?.misc.rows.length ?? 0) > 0,
  }))
  const paymentGroups = boot?.paymentGroups ?? {
    customer: { rows: [], total: 0 },
    vendor: { rows: [], total: 0 },
    misc: { rows: [], total: 0 },
  }
  const paymentSummary = boot?.paymentSummary
  const router = useRouter()
  const [quotes] = useState<OrderItemQuote[]>(() => boot?.quotes ?? [])
  const toggleSection = (key: keyof typeof openSection) => {
    setOpenSection((prev) => ({ ...prev, [key]: !prev[key] }))
  }
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
  const statusFiltered = useMemo(() => {
    if (filter === 'incomplete') return baseList.filter((h) => !h.sheetComplete)
    if (filter === 'complete') return baseList.filter((h) => h.sheetComplete)
    return baseList
  }, [baseList, filter])

  const vendorOptions = useMemo(() => {
    const names = new Set<string>()
    for (const h of statusFiltered) {
      if (h.purchaseFromAccountName) names.add(h.purchaseFromAccountName)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [statusFiltered])

  const paidToOptions = useMemo(() => {
    const names = new Set<string>()
    for (const h of statusFiltered) {
      if (h.paidToAccountName) names.add(h.paidToAccountName)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [statusFiltered])

  const columnFiltersActive =
    customerFilter.trim() !== '' ||
    paymentFilter !== 'all' ||
    vendorFilter !== 'all' ||
    paidToFilter !== 'all'

  const listOrders = useMemo(() => {
    const q = customerFilter.trim().toLowerCase()
    const filtered = statusFiltered.filter((h) => {
      if (q) {
        const hay = `${h.contactName} ${h.contactPhone}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (paymentFilter !== 'all' && h.paymentStatus !== paymentFilter) return false
      if (vendorFilter === '__none__') {
        if (h.purchaseFromAccountName) return false
      } else if (vendorFilter !== 'all' && h.purchaseFromAccountName !== vendorFilter) {
        return false
      }
      if (paidToFilter === '__none__') {
        if (h.paidToAccountName) return false
      } else if (paidToFilter !== 'all' && h.paidToAccountName !== paidToFilter) {
        return false
      }
      return true
    })
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const cmp = compareSheetHits(a, b, sortKey)
      if (cmp !== 0) return cmp * dir
      return compareSheetHits(a, b, 'createdAt') * -1 || cmpStr(a.id, b.id)
    })
  }, [statusFiltered, customerFilter, paymentFilter, vendorFilter, paidToFilter, sortKey, sortDir])

  function toggleSort(key: SheetSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    const numericFirstDesc: SheetSortKey[] = [
      'selling',
      'purchasing',
      'profit',
      'profitPct',
      'collected',
      'createdAt',
    ]
    setSortDir(numericFirstDesc.includes(key) ? 'desc' : 'asc')
  }

  function sortTh(key: SheetSortKey, label: string, align: 'left' | 'right' = 'left') {
    const active = sortKey === key
    return (
      <th
        scope="col"
        className={align === 'right' ? 'order-sheet-hits__num' : undefined}
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          className={`finance-tx-sort${active ? ' is-active' : ''}`}
          onClick={() => toggleSort(key)}
          style={align === 'right' ? { justifyContent: 'flex-end', width: '100%' } : undefined}
        >
          <span>{label}</span>
          <span className="finance-tx-sort__ind" aria-hidden>
            {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    )
  }

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

  function clearColumnFilters() {
    setCustomerFilter('')
    setPaymentFilter('all')
    setVendorFilter('all')
    setPaidToFilter('all')
  }

  function renderColumnFiltersMobile() {
    return (
      <div className="order-sheet-col-filters order-sheet-mobile-only">
        <input
          className="order-sheet-col-filters__input"
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          placeholder="Customer"
          aria-label="Filter by customer"
        />
        <select
          className="order-sheet-col-filters__select"
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as 'all' | SettlementStatus)}
          aria-label="Filter by payment status"
        >
          <option value="all">Payment: all</option>
          {(Object.keys(SETTLEMENT_LABEL) as SettlementStatus[]).map((s) => (
            <option key={s} value={s}>
              {SETTLEMENT_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className="order-sheet-col-filters__select"
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          aria-label="Filter by vendor"
        >
          <option value="all">Vendor: all</option>
          <option value="__none__">No vendor</option>
          {vendorOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="order-sheet-col-filters__select"
          value={paidToFilter}
          onChange={(e) => setPaidToFilter(e.target.value)}
          aria-label="Filter by paid to"
        >
          <option value="all">Paid to: all</option>
          <option value="__none__">No account</option>
          {paidToOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {columnFiltersActive ? (
          <button type="button" className="order-sheet-btn-ghost" onClick={clearColumnFilters}>
            Clear filters
          </button>
        ) : null}
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
              <col className="order-sheet-hits__col-vendor" />
              <col className="order-sheet-hits__col-paidto" />
              <col className="order-sheet-hits__col-id" />
              <col className="order-sheet-hits__col-action" />
            </colgroup>
            <thead>
              <tr>
                {sortTh('contact', 'Contact')}
                {sortTh('item', 'Item')}
                {sortTh('selling', 'Selling price', 'right')}
                {sortTh('purchasing', 'Purchase price', 'right')}
                {sortTh('profit', 'Profit', 'right')}
                {sortTh('profitPct', 'Profit %', 'right')}
                {sortTh('collected', 'Collected', 'right')}
                {sortTh('payment', 'Payment status')}
                {sortTh('vendor', 'Vendor')}
                {sortTh('paidTo', 'Paid to')}
                {sortTh('orderId', 'Order ID')}
                <th scope="col" />
              </tr>
              <tr className="order-sheet-hits__filters">
                <th>
                  <input
                    className="order-sheet-hits__filter-input"
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value)}
                    placeholder="Customer…"
                    aria-label="Filter by customer"
                  />
                </th>
                <th />
                <th colSpan={5} />
                <th>
                  <select
                    className="order-sheet-hits__filter-select"
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value as 'all' | SettlementStatus)}
                    aria-label="Filter by payment status"
                  >
                    <option value="all">All</option>
                    {(Object.keys(SETTLEMENT_LABEL) as SettlementStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {SETTLEMENT_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </th>
                <th>
                  <select
                    className="order-sheet-hits__filter-select"
                    value={vendorFilter}
                    onChange={(e) => setVendorFilter(e.target.value)}
                    aria-label="Filter by vendor"
                  >
                    <option value="all">All</option>
                    <option value="__none__">None</option>
                    {vendorOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </th>
                <th>
                  <select
                    className="order-sheet-hits__filter-select"
                    value={paidToFilter}
                    onChange={(e) => setPaidToFilter(e.target.value)}
                    aria-label="Filter by paid to"
                  >
                    <option value="all">All</option>
                    <option value="__none__">None</option>
                    {paidToOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </th>
                <th>
                  {columnFiltersActive ? (
                    <button
                      type="button"
                      className="order-sheet-hits__filter-clear"
                      onClick={clearColumnFilters}
                    >
                      Clear
                    </button>
                  ) : null}
                </th>
                <th />
              </tr>
              {listOrders.length > 0 ? (
                <tr className="order-sheet-hits__totals">
                  <th scope="row" colSpan={2}>
                    Totals · {listOrders.length} order{listOrders.length === 1 ? '' : 's'}
                    {columnFiltersActive ? ' (filtered)' : ''}
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
                  <th colSpan={4} />
                  <th />
                </tr>
              ) : null}
            </thead>
            <tbody>
              {listOrders.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ padding: 16, color: MUTED, textAlign: 'center' }}>
                    {searching
                      ? 'No matching orders'
                      : columnFiltersActive
                        ? 'No orders match these filters'
                        : 'No orders in this filter'}
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
                      title={
                        h.manuallySettled && h.manuallySettledNote
                          ? `Manual settle · ${h.manuallySettledNote}\nExpected ${inr(h.expected)} · balance ${inr(h.balance)}`
                          : `Expected ${inr(h.expected)} · balance ${inr(h.balance)}`
                      }
                      style={paymentStatusStyle(h.paymentStatus)}
                    >
                      {SETTLEMENT_LABEL[h.paymentStatus]}
                    </span>
                  </td>
                  <td>{h.purchaseFromAccountName || '—'}</td>
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
            {columnFiltersActive ? ' · filtered' : ''}
          </span>
          <Link href="/admin/orders/new">+ Create new order</Link>
        </div>
      </div>
    )
  }

  function renderListMobile() {
    return (
      <div className="order-sheet-mobile-list order-sheet-mobile-stack">
        {renderColumnFiltersMobile()}
        {listOrders.length === 0 && (
          <p style={{ fontSize: '0.8125rem', color: MUTED, margin: '8px 0' }}>
            {searching
              ? 'No matching orders'
              : columnFiltersActive
                ? 'No orders match these filters'
                : 'No orders in this filter'}
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
                <span>Vendor</span>
                <strong>{h.purchaseFromAccountName || '—'}</strong>
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
    const orderAmount =
      totals.selling > 0.0001
        ? totals.selling
        : editor.orderMeta.total != null
          ? editor.orderMeta.total
          : 0
    const profitPctVal = profitPct(
      totals.profit,
      totals.selling > 0.0001 ? totals.selling : orderAmount,
    )
    const balLabel = balanceStatusLabel(
      paymentSummary?.paymentStatus,
      paymentSummary?.balance ?? 0,
    )
    const payStatus = paymentSummary?.paymentStatus
    const inCompanyBank = roundMoney(paymentSummary?.settledInCompanyBank ?? 0)
    const expectedPay = paymentSummary?.expected ?? orderAmount
    const settledViaCompanyBank =
      expectedPay > 0 && inCompanyBank >= expectedPay - 0.009
    const balSettled = payStatus === 'settled'
    const balFullyPaid = payStatus === 'fully_paid'
    const txComposeHref = '/admin/finance/transactions?compose=1'

    const renderPaymentRows = (rows: OrderSheetPaymentRow[]) => {
      if (rows.length === 0) {
        return <p className="order-sheet-pay__empty">No payments recorded yet.</p>
      }
      return (
        <ul className="order-sheet-pay__list">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={row.href} className="order-sheet-pay__row" prefetch={false}>
                <div className="order-sheet-pay__row-main">
                  <div className="order-sheet-pay__row-left">
                    <span className="order-sheet-pay__date">{formatPaymentDay(row.date)}</span>
                    <span className="order-sheet-pay__flow">{row.label}</span>
                  </div>
                  <div className="order-sheet-pay__row-right">
                    <strong className="order-sheet-pay__amt">{inr(row.amount)}</strong>
                    {row.description ? (
                      <span className="order-sheet-pay__note">{row.description}</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )
    }

    return (
      <div className="order-sheet-detail">
        <nav className="order-sheet-detail__crumbs" aria-label="Breadcrumb">
          <Link href={filterHref(filter, query)} prefetch={false}>
            Orders
          </Link>
          <span aria-hidden>›</span>
          <span>Order Sheet</span>
        </nav>

        <header className="order-sheet-detail__head">
          <div className="order-sheet-detail__titles">
            <h1 className="order-sheet-detail__title">
              Order Sheet{' '}
              <span className="order-sheet-detail__oid" title={editor.orderId}>
                {shortFinanceId(editor.orderId)}
              </span>
            </h1>
          </div>
          <div className="order-sheet-detail__head-actions">
            <span className="order-sheet-detail__created">
              Created: {formatSheetDate(editor.orderMeta.createdAt)}
            </span>
            <button
              type="button"
              className="order-sheet-detail__refresh"
              onClick={() => router.refresh()}
            >
              Refresh
            </button>
          </div>
        </header>

        {error ? (
          <p className="order-sheet-detail__error" role="alert">
            {error}
          </p>
        ) : null}
        {!error && saveStatus ? (
          <p className="order-sheet-detail__ok" role="status">
            {saveStatus}
          </p>
        ) : null}

        <div className="order-sheet-detail__summary" role="group" aria-label="Order summary">
          <div className="order-sheet-detail__metric">
            <span className="order-sheet-detail__metric-icon" aria-hidden>
              ₹
            </span>
            <div>
              <span className="order-sheet-detail__metric-label">Order Amount</span>
              <strong className="order-sheet-detail__metric-value">{inr(orderAmount)}</strong>
            </div>
          </div>
          <div className="order-sheet-detail__metric">
            <span className="order-sheet-detail__metric-icon" aria-hidden>
              ↗
            </span>
            <div>
              <span className="order-sheet-detail__metric-label">Profit</span>
              <strong className="order-sheet-detail__metric-value">{inr(totals.profit)}</strong>
            </div>
          </div>
          <div className="order-sheet-detail__metric">
            <span className="order-sheet-detail__metric-icon" aria-hidden>
              %
            </span>
            <div>
              <span className="order-sheet-detail__metric-label">Profit %</span>
              <strong className="order-sheet-detail__metric-value is-accent">
                {pctOrDash(profitPctVal)}
              </strong>
            </div>
          </div>
        </div>

        <section className="order-sheet-detail__order-card" aria-label="Order details">
          <div className="order-sheet-detail__order-grid">
            <div>
              <span className="order-sheet-detail__field-label">Contact</span>
              <strong className="order-sheet-detail__field-value">
                {editor.orderLabel || '—'}
              </strong>
              {editor.orderMeta.phone ? (
                <span className="order-sheet-detail__field-sub">{editor.orderMeta.phone}</span>
              ) : null}
            </div>
            <div>
              <span className="order-sheet-detail__field-label">Item</span>
              <strong className="order-sheet-detail__field-value">
                {editor.orderMeta.itemsLabel || '—'}
              </strong>
              {quotes.length > 0 ? (
                <span className="order-sheet-detail__field-sub">
                  {quotes.length} line{quotes.length === 1 ? '' : 's'} · Quoted Σ{' '}
                  {inr(quotes.reduce((s, q) => s + q.quotedTotal, 0))}
                </span>
              ) : null}
            </div>
            <div>
              <span className="order-sheet-detail__field-label">Status</span>
              <strong className="order-sheet-detail__field-value">
                {editor.orderMeta.status ? statusLabel(editor.orderMeta.status) : '—'}
              </strong>
              {editor.orderMeta.total != null ? (
                <span className="order-sheet-detail__field-sub">
                  Cash {inr(editor.orderMeta.total)}
                </span>
              ) : null}
              {editor.orderMeta.autoDiscount != null && editor.orderMeta.autoDiscount > 0 ? (
                <span className="order-sheet-detail__field-sub">
                  Discount {inr(editor.orderMeta.autoDiscount)}
                  {editor.orderMeta.autoDiscountLabel
                    ? ` (${editor.orderMeta.autoDiscountLabel})`
                    : ''}
                </span>
              ) : null}
              {editor.orderMeta.couponDiscount != null && editor.orderMeta.couponDiscount > 0 ? (
                <span className="order-sheet-detail__field-sub">
                  Coupon {inr(editor.orderMeta.couponDiscount)}
                  {editor.orderMeta.couponDiscountLabel
                    ? ` (${editor.orderMeta.couponDiscountLabel})`
                    : ''}
                </span>
              ) : null}
            </div>
          </div>
          <Link
            href={`/admin/orders/${editor.orderId}`}
            className="order-sheet-detail__open-order"
            prefetch={false}
          >
            Open order
          </Link>
        </section>

        <div className="order-sheet-accordions">
          <section className={`order-sheet-accord${openSection.prices ? ' is-open' : ''}`}>
            <button
              type="button"
              className="order-sheet-accord__head"
              aria-expanded={openSection.prices}
              onClick={() => toggleSection('prices')}
            >
              <span>Purchase &amp; selling prices</span>
              <span className="order-sheet-accord__chevron" aria-hidden>
                {openSection.prices ? '▾' : '▸'}
              </span>
            </button>
            {openSection.prices ? (
              <div className="order-sheet-accord__body">
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
                        <strong>Quoted</strong> — reference only (not saved). Live catalogue prices
                        for each line, except <strong>Gold</strong>, which uses the gold value
                        frozen on the order at checkout.
                      </li>
                      <li>
                        <strong>Purchase price</strong> — what you paid the vendor for that line.
                        Enter ₹0 / leave blank if not applicable. A sheet is complete when every
                        line with a selling price also has a non-zero purchase price.
                      </li>
                      <li>
                        <strong>Selling price</strong> — what the customer paid for that line.
                        Prefills from the order&apos;s checkout price breakdown (gold through
                        discount, including certification, packaging, delivery, and combined misc).
                        Edit before saving if needed.
                      </li>
                    </ul>
                    <p>
                      Profit on the sheet = sum of selling − discount − sum of purchase. Blank
                      fields count as ₹0. Discount never needs a purchase price.
                    </p>
                  </div>
                </details>

                {quotes.length === 0 && (
                  <p className="order-sheet-accord__hint">
                    No line items on this order — quoted amounts unavailable. You can still enter
                    purchase and selling prices.
                  </p>
                )}

                <form action={saveOrderSheetAction} className="order-sheet-sheet-form">
              <input type="hidden" name="orderId" value={editor.orderId} />

              <div className="order-sheet-lines-scroll order-sheet-desk">
                <div className="order-sheet-lines-head" style={linesGridStyle} aria-hidden>
                  <span>Component</span>
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
                      {quotes.map((q) => {
                        const amt = q.byKind[kind] ?? 0
                        const shown = kind === 'DISCOUNT' && amt > 0 ? -amt : amt
                        return (
                          <div key={q.orderItemId} className="order-sheet-row__quote">
                            <div className="order-sheet-quote-value">{inr(shown)}</div>
                          </div>
                        )
                      })}
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
                    {quotes.map((q) => {
                      const amt = q.byKind[kind] ?? 0
                      const shown = kind === 'DISCOUNT' && amt > 0 ? -amt : amt
                      return (
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
                          <strong>{inr(shown)}</strong>
                        </div>
                      )
                    })}
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
                  <FinanceAccountSelectOptions accounts={accounts} />
                </select>
              </label>

              {totals.cost > 0 && (
                <label className="order-sheet-field" style={{ marginTop: 14 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    Purchase from (vendor)
                    <span className="finance-dash__kpi-tip">
                      <button
                        type="button"
                        className="finance-dash__kpi-info"
                        aria-label="About purchase from vendor"
                      >
                        i
                      </button>
                      <span className="finance-dash__kpi-tip-text" role="tooltip">
                        Optional. Which vendor wallet this purchase (CP) is attributed to. Leave blank
                        if none. Only vendors whose dashboard outflow includes order sheets appear
                        here; counts as outflow when that vendor’s source is order sheets or both.
                      </span>
                    </span>
                  </span>
                  <select
                    style={{
                      ...control,
                      fontSize: '16px',
                      ...(locked ? { background: '#f3f4f6', color: '#9ca3af' } : null),
                    }}
                    name="purchaseFromAccountId"
                    value={editor.purchaseFromAccountId}
                    onChange={(e) =>
                      setEditor((prev) => ({ ...prev, purchaseFromAccountId: e.target.value }))
                    }
                    disabled={locked}
                  >
                    <option value="">— None —</option>
                    {vendorAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {renderSaveBar()}
                </form>
              </div>
            ) : null}
          </section>

          <section className={`order-sheet-accord${openSection.customer ? ' is-open' : ''}`}>
            <button
              type="button"
              className="order-sheet-accord__head"
              aria-expanded={openSection.customer}
              onClick={() => toggleSection('customer')}
            >
              <span>Customer payments</span>
              <span className="order-sheet-accord__chevron" aria-hidden>
                {openSection.customer ? '▾' : '▸'}
              </span>
            </button>
            {openSection.customer ? (
              <div className="order-sheet-accord__body">
                <div className="order-sheet-pay__intro">
                  <p className="order-sheet-pay__who">
                    Customer — {editor.orderLabel || shortFinanceId(editor.orderId)}
                  </p>
                  <p className="order-sheet-pay__summary">
                    Owed {inr(paymentSummary?.expected ?? orderAmount)} · Paid{' '}
                    {inr(paymentSummary?.collected ?? paymentGroups.customer.total)} ·{' '}
                    <span
                      className={
                        balSettled ? 'is-settled' : balFullyPaid ? 'is-settled' : 'is-open-bal'
                      }
                    >
                      {balLabel}
                    </span>
                  </p>
                </div>
                {renderPaymentRows(paymentGroups.customer.rows)}
                <Link href={txComposeHref} className="order-sheet-pay__add" prefetch={false}>
                  + Add payment from customer
                </Link>

                <div className="order-sheet-settle">
                  <h3 className="order-sheet-settle__title">Manual settle</h3>
                  <p className="order-sheet-settle__hint">
                    Settled is automatic when money reaches Company bank — an INFLOW paid through
                    Company bank, or a TRANSFER into Company bank with this order attached. Use Mark
                    settled when funds never reached Company bank; add a note explaining what
                    happened to the money.
                  </p>
                  {settledViaCompanyBank && !editor.manuallySettled ? (
                    <div className="order-sheet-settle__badge">
                      Already settled via Company bank ({inr(inCompanyBank)} of {inr(expectedPay)}
                      ).
                    </div>
                  ) : null}
                  {editor.manuallySettled ? (
                    <div className="order-sheet-settle__badge">
                      <strong>Manually settled</strong>
                      {editor.manuallySettledBy ? ` by ${editor.manuallySettledBy}` : ''}
                      {editor.manuallySettledAt
                        ? ` · ${formatSheetDate(editor.manuallySettledAt)}`
                        : ''}
                      {editor.manuallySettledNote ? (
                        <div className="order-sheet-settle__note">{editor.manuallySettledNote}</div>
                      ) : null}
                    </div>
                  ) : null}
                  {!settledViaCompanyBank ? (
                    <>
                      <label className="order-sheet-field">
                        <span>
                          Notes{' '}
                          {editor.manuallySettled
                            ? '(update / required to re-save)'
                            : '(required)'}
                        </span>
                        <textarea
                          value={settleNote}
                          onChange={(e) => setSettleNote(e.target.value)}
                          rows={3}
                          placeholder="What happened to the funds (e.g. held in partner wallet)…"
                          style={{ ...control, resize: 'vertical', minHeight: 72 }}
                          disabled={settleBusy}
                        />
                      </label>
                      {settleError ? (
                        <p className="order-sheet-detail__error" role="alert">
                          {settleError}
                        </p>
                      ) : null}
                      {settleStatus ? (
                        <p className="order-sheet-detail__ok" role="status">
                          {settleStatus}
                        </p>
                      ) : null}
                      <div className="order-sheet-settle__actions">
                        <button
                          type="button"
                          className="order-sheet-row-action"
                          disabled={settleBusy || !settleNote.trim()}
                          onClick={async () => {
                            setSettleBusy(true)
                            setSettleError('')
                            setSettleStatus('')
                            try {
                              const res = await fetch(
                                `/api/admin/finance/orders/${encodeURIComponent(editor.orderId)}/settle`,
                                {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    settle: true,
                                    note: settleNote.trim(),
                                  }),
                                },
                              )
                              const data = await res.json().catch(() => ({}))
                              if (!res.ok) throw new Error(data.error || 'Failed to settle')
                              setEditor((prev) => ({
                                ...prev,
                                hasSheet: true,
                                manuallySettled: true,
                                manuallySettledNote:
                                  data.manuallySettledNote ?? settleNote.trim(),
                                manuallySettledBy: data.manuallySettledBy ?? null,
                                manuallySettledAt:
                                  data.manuallySettledAt ?? new Date().toISOString(),
                              }))
                              setSettleStatus('Marked settled')
                              router.refresh()
                            } catch (e) {
                              setSettleError(
                                e instanceof Error ? e.message : 'Failed to settle',
                              )
                            } finally {
                              setSettleBusy(false)
                            }
                          }}
                        >
                          {settleBusy
                            ? 'Saving…'
                            : editor.manuallySettled
                              ? 'Update settle notes'
                              : 'Mark settled'}
                        </button>
                        {editor.manuallySettled ? (
                          <button
                            type="button"
                            className="order-sheet-row-action order-sheet-row-action--ghost"
                            disabled={settleBusy}
                            onClick={async () => {
                              setSettleBusy(true)
                              setSettleError('')
                              setSettleStatus('')
                              try {
                                const res = await fetch(
                                  `/api/admin/finance/orders/${encodeURIComponent(editor.orderId)}/settle`,
                                  {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ settle: false }),
                                  },
                                )
                                const data = await res.json().catch(() => ({}))
                                if (!res.ok) throw new Error(data.error || 'Failed to clear')
                                setEditor((prev) => ({
                                  ...prev,
                                  manuallySettled: false,
                                  manuallySettledNote: '',
                                  manuallySettledBy: null,
                                  manuallySettledAt: null,
                                }))
                                setSettleNote('')
                                setSettleStatus('Manual settle cleared')
                                router.refresh()
                              } catch (e) {
                                setSettleError(
                                  e instanceof Error ? e.message : 'Failed to clear',
                                )
                              } finally {
                                setSettleBusy(false)
                              }
                            }}
                          >
                            Clear manual settle
                          </button>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>

          <section className={`order-sheet-accord${openSection.vendor ? ' is-open' : ''}`}>
            <button
              type="button"
              className="order-sheet-accord__head"
              aria-expanded={openSection.vendor}
              onClick={() => toggleSection('vendor')}
            >
              <span>Vendor payments</span>
              <span className="order-sheet-accord__chevron" aria-hidden>
                {openSection.vendor ? '▾' : '▸'}
              </span>
            </button>
            {openSection.vendor ? (
              <div className="order-sheet-accord__body">
                <div className="order-sheet-pay__intro">
                  <p className="order-sheet-pay__summary">
                    Paid to vendors {inr(paymentGroups.vendor.total)}
                  </p>
                </div>
                {renderPaymentRows(paymentGroups.vendor.rows)}
                <Link href={txComposeHref} className="order-sheet-pay__add" prefetch={false}>
                  + Add vendor payment
                </Link>
              </div>
            ) : null}
          </section>

          <section className={`order-sheet-accord${openSection.misc ? ' is-open' : ''}`}>
            <button
              type="button"
              className="order-sheet-accord__head"
              aria-expanded={openSection.misc}
              onClick={() => toggleSection('misc')}
            >
              <span>Misc payments</span>
              <span className="order-sheet-accord__chevron" aria-hidden>
                {openSection.misc ? '▾' : '▸'}
              </span>
            </button>
            {openSection.misc ? (
              <div className="order-sheet-accord__body">
                <div className="order-sheet-pay__intro">
                  <p className="order-sheet-pay__who">General expense allocated to this order</p>
                  <p className="order-sheet-pay__summary">
                    Total {inr(paymentGroups.misc.total)}
                  </p>
                </div>
                {renderPaymentRows(paymentGroups.misc.rows)}
                <Link href={txComposeHref} className="order-sheet-pay__add" prefetch={false}>
                  + Add misc payment
                </Link>
              </div>
            ) : null}
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
                  {columnFiltersActive ? ' (filtered)' : ''}
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
