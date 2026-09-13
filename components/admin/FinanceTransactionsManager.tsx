'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FinanceAccountSelectOptions, isVendorFinanceAccount } from '@/components/admin/FinanceAccountSelectOptions'
import { toDateInput, shortFinanceId, roundMoney, type FinanceCategoryDirection, type FinanceTransactionDirection } from '@/lib/finance'
import {
  FinanceAllocationEditor,
  allocationsFromRow,
  allocationsToPayload,
  type AllocDraft,
} from '@/components/admin/FinanceAllocationEditor'
import {
  TX_ALLOCATION_LABEL,
  type TxAllocationStatus,
} from '@/lib/finance-tx-allocation-status'

export type TxAccount = {
  id: string
  name: string
  type?: string
  isVendorWallet?: boolean
}
export type TxContact = { id: string; name: string; type: string }
export type TxCategory = { id: string; name: string; direction: FinanceCategoryDirection }
export type TxRow = {
  id: string
  date: string
  direction: FinanceTransactionDirection
  amount: number
  gstAmount: number
  description: string
  accountId: string
  accountName: string | null
  paidThroughAccountId: string
  paidThroughAccountName: string | null
  transferToAccountId: string | null
  transferToAccountName: string | null
  categoryId: string | null
  categoryName: string | null
  contactId: string | null
  contactName: string | null
  /** true = payment confirmation; false = Manual cashbook entry */
  autoCreated: boolean
  reviewComplete: boolean
  orderIds: string[]
  unlinkedOrderLabels?: string[]
  orders?: { id: string; contactName: string }[]
  inventoryItemIds?: string[]
  unlinkedInventoryLabels?: string[]
  inventoryItems?: { id: string; label: string }[]
  allocations?: {
    id?: string
    amount: number
    orderId: string | null
    purchaseBillId: string | null
    label: string
    href?: string | null
  }[]
  allocatedAmount?: number
  unallocatedAmount?: number
  overAllocatedAmount?: number
  allocationStatus?: TxAllocationStatus
}

const GREEN = '#032b24'
const GREEN_CHIP = '#dceee8'
const BORDER = '#e5e7eb'
const LABEL = '#374151'
const MUTED = '#6b7280'

const field: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: LABEL,
  minWidth: 0,
}

const req: React.CSSProperties = { color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }

const control: React.CSSProperties = {
  width: '100%',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: '0.875rem',
  fontWeight: 400,
  color: '#111827',
  background: '#fff',
  boxSizing: 'border-box',
  outline: 'none',
}

const selectControl: React.CSSProperties = {
  ...control,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M2.5 4.5L6 8L9.5 4.5' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 32,
  cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: '10px 18px',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#111827',
  background: '#fff',
  cursor: 'pointer',
}

const btnPrimary: React.CSSProperties = {
  border: 'none',
  borderRadius: 8,
  padding: '10px 22px',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#fff',
  background: GREEN,
  cursor: 'pointer',
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke="#9ca3af" strokeWidth="1.5" />
      <path d="M10.5 10.5L13.5 13.5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

type FilterMultiOption = { id: string; label: string; group?: string }

type TxSortKey =
  | 'id'
  | 'date'
  | 'direction'
  | 'source'
  | 'handled'
  | 'amount'
  | 'gst'
  | 'bank'
  | 'category'
  | 'contact'
  | 'description'
  | 'allocation'
  | 'review'

type TxSortDir = 'asc' | 'desc'

function cmpStr(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true })
}

function txSortValue(row: TxRow, key: TxSortKey): string | number {
  switch (key) {
    case 'id':
      return row.id
    case 'date':
      return new Date(row.date).getTime()
    case 'direction':
      return row.direction
    case 'source':
      return row.autoCreated ? 1 : 0
    case 'handled':
      return (row.accountName ?? row.accountId ?? '').toLowerCase()
    case 'amount':
      return row.amount
    case 'gst':
      return row.gstAmount || 0
    case 'bank':
      return (row.paidThroughAccountName ?? row.paidThroughAccountId ?? '').toLowerCase()
    case 'category':
      return (row.categoryName ?? '').toLowerCase()
    case 'contact':
      return (row.contactName ?? '').toLowerCase()
    case 'description':
      return (row.description ?? '').toLowerCase()
    case 'allocation':
      return row.allocatedAmount ?? 0
    case 'review':
      return row.reviewComplete ? 1 : 0
  }
}

/** Checkbox multi-select dropdown for transaction list filters. Empty selection = all. */
function FilterMultiSelect({
  label,
  options,
  value,
  onChange,
  allLabel = 'All',
}: {
  label: string
  options: FilterMultiOption[]
  value: string[]
  onChange: (next: string[]) => void
  allLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const summary =
    value.length === 0
      ? `${label}: ${allLabel}`
      : value.length === 1
        ? `${label}: ${options.find((o) => o.id === value[0])?.label ?? '1'}`
        : `${label}: ${value.length} selected`

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  }

  const grouped = useMemo(() => {
    const hasGroups = options.some((o) => o.group)
    if (!hasGroups) return [{ group: null as string | null, items: options }]
    const map = new Map<string, FilterMultiOption[]>()
    for (const o of options) {
      const g = o.group ?? 'Other'
      const list = map.get(g) ?? []
      list.push(o)
      map.set(g, list)
    }
    // Accounts before Vendors when both present
    const order = ['Accounts', 'Vendors']
    return [...map.entries()]
      .sort(([a], [b]) => {
        const ia = order.indexOf(a)
        const ib = order.indexOf(b)
        if (ia === -1 && ib === -1) return a.localeCompare(b)
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
      .map(([group, items]) => ({ group, items }))
  }, [options])

  return (
    <div className="finance-filter-dd" ref={wrapRef}>
      <button
        type="button"
        className={`finance-filter-dd__btn${value.length > 0 ? ' is-active' : ''}${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="finance-filter-dd__summary">{summary}</span>
        <span className="finance-filter-dd__caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="finance-filter-dd__panel" role="listbox" aria-multiselectable aria-label={label}>
          {options.length === 0 ? (
            <div className="finance-filter-dd__empty">No options</div>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group ?? 'all'} className="finance-filter-dd__group">
                {group ? <div className="finance-filter-dd__group-label">{group}</div> : null}
                {items.map((o) => (
                  <label key={o.id} className="finance-filter-dd__option">
                    <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            ))
          )}
          {value.length > 0 ? (
            <button type="button" className="finance-filter-dd__clear" onClick={() => onChange([])}>
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function FinanceTransactionsManager({
  initial,
  accounts,
  contacts,
  categories,
  defaultAccountId: _defaultAccountId,
  compose = false,
  editId = null,
}: {
  initial: TxRow[]
  accounts: TxAccount[]
  contacts: TxContact[]
  categories: TxCategory[]
  defaultAccountId: string | null
  /** Open the record form (from ?compose=1). Native link — works on mobile. */
  compose?: boolean
  /** Prefill edit form (from ?edit=id). */
  editId?: string | null
}) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(editId)
  const formRef = useRef<HTMLElement>(null)
  const [date, setDate] = useState(() => toDateInput(new Date()))
  const [direction, setDirection] = useState<FinanceTransactionDirection>('OUTFLOW')
  const [amount, setAmount] = useState('')
  const [gstAmount, setGstAmount] = useState('')
  const [description, setDescription] = useState('')
  const [accountId, setAccountId] = useState('')
  const [paidThroughAccountId, setPaidThroughAccountId] = useState('')
  const [transferToAccountId, setTransferToAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [contactId, setContactId] = useState<string | null>(null)
  const [contactText, setContactText] = useState('')
  const [contactOpen, setContactOpen] = useState(false)
  const contactWrapRef = useRef<HTMLDivElement>(null)
  const [allocations, setAllocations] = useState<AllocDraft[]>([])
  /** Saved allocation amounts by order/bill id when edit started (for Due stubs). */
  const [priorCredits, setPriorCredits] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [dirFilters, setDirFilters] = useState<string[]>([])
  const [handledFilters, setHandledFilters] = useState<string[]>([])
  const [bankFilters, setBankFilters] = useState<string[]>([])
  const [categoryFilters, setCategoryFilters] = useState<string[]>([])
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [sortKey, setSortKey] = useState<TxSortKey>('date')
  const [sortDir, setSortDir] = useState<TxSortDir>('desc')

  const filtersActive =
    query.trim().length > 0 ||
    dirFilters.length > 0 ||
    handledFilters.length > 0 ||
    bankFilters.length > 0 ||
    categoryFilters.length > 0

  function clearAllFilters() {
    setQuery('')
    setDirFilters([])
    setHandledFilters([])
    setBankFilters([])
    setCategoryFilters([])
  }

  const showForm = compose || !!editId || !!editingId
  const tableColSpan = showAllColumns ? 14 : 12

  const accountsSorted = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  )
  const accountFilterOptions = useMemo(
    () =>
      accountsSorted.map((a) => ({
        id: a.id,
        label: a.name,
        group: isVendorFinanceAccount(a) ? 'Vendors' : 'Accounts',
      })),
    [accountsSorted],
  )
  const contactsSorted = useMemo(
    () => [...contacts].sort((a, b) => a.name.localeCompare(b.name)),
    [contacts],
  )
  const categoriesSorted = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  )

  const contactSuggestions = useMemo(() => {
    const q = contactText.trim().toLowerCase()
    if (!q) return contactsSorted.slice(0, 8)
    return contactsSorted
      .filter((c) => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q))
      .slice(0, 8)
  }, [contactText, contactsSorted])

  const categoriesForDirection = useMemo(
    () =>
      direction === 'TRANSFER'
        ? []
        : categoriesSorted.filter((c) => c.direction === direction),
    [categoriesSorted, direction],
  )

  const categoryFilterOptions = useMemo(() => {
    if (dirFilters.length === 0) return categoriesSorted
    const dirs = new Set(dirFilters.filter((d) => d === 'INFLOW' || d === 'OUTFLOW'))
    if (dirs.size === 0) return []
    return categoriesSorted.filter((c) => dirs.has(c.direction))
  }, [categoriesSorted, dirFilters])

  function onDirFiltersChange(next: string[]) {
    setDirFilters(next)
    setCategoryFilters((prev) => {
      if (next.length === 0) return prev
      const dirs = new Set(next.filter((d) => d === 'INFLOW' || d === 'OUTFLOW'))
      if (dirs.size === 0) return []
      return prev.filter((id) => {
        const cat = categories.find((c) => c.id === id)
        return cat ? dirs.has(cat.direction) : false
      })
    })
  }

  function changeDirection(next: FinanceTransactionDirection) {
    setDirection(next)
    setCategoryId((prev) => {
      if (!prev || next === 'TRANSFER') return ''
      const cat = categories.find((c) => c.id === prev)
      return cat && cat.direction === next ? prev : ''
    })
    if (next === 'TRANSFER') {
      setAllocations([])
      setContactId(null)
      setContactText('')
      if (transferToAccountId && transferToAccountId === paidThroughAccountId) {
        setTransferToAccountId('')
      }
    }
  }

  function onContactTextChange(value: string) {
    setContactText(value)
    setContactId(null)
    setContactOpen(true)
  }

  function pickContact(c: TxContact) {
    setContactId(c.id)
    setContactText(c.name)
    setContactOpen(false)
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (dirFilters.length > 0 && !dirFilters.includes(r.direction)) return false
      if (handledFilters.length > 0 && !handledFilters.includes(r.accountId)) return false
      if (
        bankFilters.length > 0 &&
        !bankFilters.includes(r.paidThroughAccountId) &&
        !(r.transferToAccountId && bankFilters.includes(r.transferToAccountId))
      ) {
        return false
      }
      if (categoryFilters.length > 0 && (!r.categoryId || !categoryFilters.includes(r.categoryId))) {
        return false
      }
      if (!q) return true
      const orderText = [
        ...(r.orders?.map((o) => `${o.contactName} ${o.id}`) ?? []),
        ...r.orderIds,
        ...(r.unlinkedOrderLabels ?? []),
        ...(r.inventoryItems?.map((i) => `${i.label} ${i.id}`) ?? []),
        ...(r.inventoryItemIds ?? []),
        ...(r.unlinkedInventoryLabels ?? []),
        ...(r.allocations?.map((a) => a.label) ?? []),
      ]
        .join(' ')
        .toLowerCase()
      const hay = [
        r.description,
        r.contactName,
        r.categoryName,
        r.accountName,
        r.paidThroughAccountName,
        r.amount.toString(),
        toDateInput(new Date(r.date)),
        r.autoCreated ? 'auto-created' : 'manual',
        orderText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, query, dirFilters, handledFilters, bankFilters, categoryFilters])

  const filterTotals = useMemo(() => {
    let inflow = 0
    let outflow = 0
    let transfer = 0
    let transferIn = 0
    let transferOut = 0
    let gst = 0
    for (const r of filteredRows) {
      gst += r.gstAmount || 0
      if (r.direction === 'INFLOW') {
        inflow += r.amount
      } else if (r.direction === 'OUTFLOW') {
        outflow += r.amount
      } else if (r.direction === 'TRANSFER') {
        transfer += r.amount
        // Same convention as summarizeTransactionFlows: From = out, To = in.
        // With no bank filter both legs count and cancel; with bank filter only matching legs.
        const fromMatches =
          bankFilters.length === 0 || bankFilters.includes(r.paidThroughAccountId)
        const toMatches =
          bankFilters.length === 0 ||
          Boolean(r.transferToAccountId && bankFilters.includes(r.transferToAccountId))
        if (fromMatches) transferOut += r.amount
        if (toMatches) transferIn += r.amount
      }
    }
    return {
      count: filteredRows.length,
      inflow: roundMoney(inflow),
      outflow: roundMoney(outflow),
      transfer: roundMoney(transfer),
      gst: roundMoney(gst),
      net: roundMoney(inflow + transferIn - outflow - transferOut),
    }
  }, [filteredRows, bankFilters])

  const sortedRows = useMemo(() => {
    const list = [...filteredRows]
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const va = txSortValue(a, sortKey)
      const vb = txSortValue(b, sortKey)
      let cmp = 0
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
      else cmp = cmpStr(String(va), String(vb))
      if (cmp !== 0) return cmp * dir
      // Stable-ish tie-break: newer date first, then id
      const td = new Date(b.date).getTime() - new Date(a.date).getTime()
      if (td !== 0) return td
      return cmpStr(a.id, b.id)
    })
    return list
  }, [filteredRows, sortKey, sortDir])

  function toggleSort(key: TxSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'date' || key === 'amount' || key === 'gst' || key === 'allocation' ? 'desc' : 'asc')
    }
  }

  function sortTh(key: TxSortKey, label: string, align: 'left' | 'right' = 'left') {
    const active = sortKey === key
    return (
      <th style={{ ...th, textAlign: align }} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          className={`finance-tx-sort${active ? ' is-active' : ''}`}
          onClick={() => toggleSort(key)}
        >
          <span>{label}</span>
          <span className="finance-tx-sort__ind" aria-hidden>
            {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    )
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!contactWrapRef.current?.contains(e.target as Node)) setContactOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    if (!editId) return
    const row = rows.find((r) => r.id === editId) ?? initial.find((r) => r.id === editId)
    if (row) applyRow(row)
    // Scroll form into view after paint (mobile)
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when URL edit id changes
  }, [editId])

  function applyRow(row: TxRow) {
    setEditingId(row.id)
    setDate(toDateInput(new Date(row.date)))
    setDirection(row.direction)
    setAmount(String(row.amount))
    setGstAmount(row.gstAmount ? String(row.gstAmount) : '')
    setDescription(row.description)
    setAccountId(row.accountId)
    setPaidThroughAccountId(row.paidThroughAccountId)
    setTransferToAccountId(row.transferToAccountId ?? '')
    setCategoryId(row.categoryId ?? '')
    setContactId(row.contactId)
    setContactText(row.contactName ?? '')
    setContactOpen(false)
    const drafts = allocationsFromRow(row)
    setAllocations(drafts)
    const credits: Record<string, number> = {}
    for (const a of drafts) {
      const id = a.orderId ?? a.purchaseBillId
      if (!id) continue
      credits[id] = roundMoney((credits[id] ?? 0) + (Number(a.amount) || 0))
    }
    setPriorCredits(credits)
    setError('')
  }

  function leaveForm() {
    setEditingId(null)
    setDate(toDateInput(new Date()))
    setDirection('OUTFLOW')
    setAmount('')
    setGstAmount('')
    setDescription('')
    setAccountId('')
    setPaidThroughAccountId('')
    setTransferToAccountId('')
    setCategoryId('')
    setContactId(null)
    setContactText('')
    setContactOpen(false)
    setAllocations([])
    setPriorCredits({})
    setError('')
    router.push('/admin/finance/transactions')
  }

  function reset() {
    leaveForm()
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const isTransfer = direction === 'TRANSFER'
    const allocationPayload = isTransfer ? [] : allocationsToPayload(allocations)
    if (!isTransfer && allocations.length > 0 && allocationPayload.length === 0) {
      setError('Enter an amount for each allocation')
      return
    }
    if (isTransfer) {
      if (!transferToAccountId) {
        setError('Select a To account')
        return
      }
      if (transferToAccountId === paidThroughAccountId) {
        setError('From and To accounts must be different')
        return
      }
    }
    setSaving(true)
    const body = {
      date,
      direction,
      amount: Number(amount),
      gstAmount: isTransfer ? 0 : Number(gstAmount || 0),
      description,
      accountId,
      paidThroughAccountId,
      transferToAccountId: isTransfer ? transferToAccountId : null,
      categoryId: isTransfer ? null : categoryId || null,
      contactId: isTransfer ? null : contactId || null,
      contactName: isTransfer ? '' : contactText.trim(),
      orderIds: allocationPayload
        .map((a) => a.orderId)
        .filter((id): id is string => Boolean(id)),
      unlinkedOrderLabels: [] as string[],
      inventoryItemIds: [] as string[],
      unlinkedInventoryLabels: [] as string[],
      allocations: allocationPayload,
    }
    try {
      const res = await fetch(
        editingId ? `/api/admin/finance/transactions/${editingId}` : '/api/admin/finance/transactions',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Save failed')
        return
      }
      const id = editingId
      router.push('/admin/finance/transactions')
      router.refresh()
      setRows((rs) => {
        if (id) return rs.map((r) => (r.id === id ? json : r))
        return [json, ...rs]
      })
      setEditingId(null)
      setDate(toDateInput(new Date()))
      setDirection('OUTFLOW')
      setAmount('')
      setGstAmount('')
      setDescription('')
      setAccountId('')
      setPaidThroughAccountId('')
      setTransferToAccountId('')
      setCategoryId('')
      setContactId(null)
      setContactText('')
      setContactOpen(false)
      setAllocations([])
      setError('')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this transaction?')) return
    const res = await fetch(`/api/admin/finance/transactions/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    setRows((rs) => rs.filter((r) => r.id !== id))
    router.refresh()
  }

  async function setReviewStatus(id: string, reviewComplete: boolean) {
    const res = await fetch(`/api/admin/finance/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewComplete }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(json.error ?? 'Could not update review status')
      return
    }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...json } : r)))
    router.refresh()
  }

  const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  const th: React.CSSProperties = {
    padding: '12px 14px',
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: MUTED,
    borderBottom: `1px solid ${BORDER}`,
    whiteSpace: 'nowrap',
  }

  const td: React.CSSProperties = {
    padding: '14px 14px',
    borderBottom: '1px solid #f3f4f6',
    verticalAlign: 'middle',
    color: '#111827',
  }

  const actionBtn: React.CSSProperties = {
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: '0.75rem',
    fontWeight: 500,
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  }

  const txForm = (
        <form onSubmit={save} style={{ display: 'grid', gap: 18 }}>
          <div
            className={
              direction === 'TRANSFER'
                ? 'finance-tx-form-split finance-tx-form-split--single'
                : 'finance-tx-form-split'
            }
          >
            <div className="finance-tx-form-split__main" style={{ display: 'grid', gap: 18, minWidth: 0 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
            }}
          >
            <label style={field}>
              <span>
                Who handled this transaction{'\u00a0'}
                <span style={req}>*</span>
              </span>
              <select
                style={selectControl}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
              >
                <option value="">— Select —</option>
                <FinanceAccountSelectOptions accounts={accounts} />
              </select>
            </label>
            {direction === 'TRANSFER' ? (
              <>
                <label style={field}>
                  <span>
                    From{'\u00a0'}
                    <span style={req}>*</span>
                  </span>
                  <select
                    style={selectControl}
                    value={paidThroughAccountId}
                    onChange={(e) => {
                      const from = e.target.value
                      setPaidThroughAccountId(from)
                      if (transferToAccountId === from) {
                        setTransferToAccountId('')
                      }
                    }}
                    required
                  >
                    <option value="">— Select —</option>
                    <FinanceAccountSelectOptions accounts={accounts} />
                  </select>
                </label>
                <label style={field}>
                  <span>
                    To{'\u00a0'}
                    <span style={req}>*</span>
                  </span>
                  <select
                    style={selectControl}
                    value={transferToAccountId}
                    onChange={(e) => setTransferToAccountId(e.target.value)}
                    required
                  >
                    <option value="">— Select —</option>
                    <FinanceAccountSelectOptions accounts={accounts} excludeId={paidThroughAccountId} />
                  </select>
                </label>
              </>
            ) : (
              <label style={field}>
                <span>
                  Which bank account was used{'\u00a0'}
                  <span style={req}>*</span>
                </span>
                <select
                  style={selectControl}
                  value={paidThroughAccountId}
                  onChange={(e) => setPaidThroughAccountId(e.target.value)}
                  required
                >
                  <option value="">— Select —</option>
                  <FinanceAccountSelectOptions accounts={accounts} />
                </select>
              </label>
            )}
            {direction !== 'TRANSFER' && (
            <div style={field} ref={contactWrapRef}>
              <span>Contact (Vendor / Customer)</span>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...control, paddingRight: 36 }}
                  value={contactText}
                  onChange={(e) => onContactTextChange(e.target.value)}
                  onFocus={() => setContactOpen(true)}
                  placeholder="Select a contact or type a name…"
                  autoComplete="off"
                />
                <button
                  type="button"
                  aria-label="Show contacts"
                  onClick={() => setContactOpen((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    fontSize: 10,
                    padding: 4,
                  }}
                >
                  ▾
                </button>
                {contactOpen && (
                  <ul
                    style={{
                      position: 'absolute',
                      zIndex: 20,
                      left: 0,
                      right: 0,
                      top: 'calc(100% + 4px)',
                      listStyle: 'none',
                      margin: 0,
                      padding: 0,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      background: '#fff',
                      maxHeight: 200,
                      overflow: 'auto',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
                    }}
                  >
                    {contactSuggestions.length === 0 ? (
                      <li style={{ padding: '10px 12px', fontSize: '0.8125rem', color: MUTED }}>
                        {contactText.trim()
                          ? `Use “${contactText.trim()}” as free text`
                          : 'No contacts yet — type a name'}
                      </li>
                    ) : (
                      contactSuggestions.map((c) => (
                        <li key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <button
                            type="button"
                            onClick={() => pickContact(c)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '10px 12px',
                              border: 'none',
                              background: contactId === c.id ? GREEN_CHIP : 'transparent',
                              cursor: 'pointer',
                              fontSize: '0.8125rem',
                            }}
                          >
                            {c.name}
                            <span style={{ color: MUTED, marginLeft: 8 }}>({c.type})</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
              {contactId ? (
                <span style={{ fontSize: '0.6875rem', color: MUTED }}>Linked to saved contact</span>
              ) : contactText.trim() ? (
                <span style={{ fontSize: '0.6875rem', color: MUTED }}>Will save as free text</span>
              ) : null}
            </div>
            )}
          </div>

          <div style={field}>
            <span>
              Direction{'\u00a0'}
              <span style={req}>*</span>
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {(
                [
                  ['INFLOW', 'Inflow'],
                  ['OUTFLOW', 'Outflow'],
                  ['TRANSFER', 'Transfer'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeDirection(value)}
                  style={{
                    border: `1.5px solid ${direction === value ? GREEN : BORDER}`,
                    background: direction === value ? GREEN_CHIP : '#fff',
                    color: direction === value ? GREEN : '#374151',
                    borderRadius: 999,
                    padding: '10px 18px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 14,
            }}
          >
            <label style={field}>
              <span>
                Date{'\u00a0'}
                <span style={req}>*</span>
              </span>
              <input style={control} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label style={field}>
              <span>
                Amount (₹){'\u00a0'}
                <span style={req}>*</span>
              </span>
              <input
                style={control}
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0"
              />
            </label>
            {direction !== 'TRANSFER' && (
              <label style={field}>
                <span>GST (₹)</span>
                <input
                  style={control}
                  type="number"
                  min="0"
                  step="0.01"
                  value={gstAmount}
                  onChange={(e) => setGstAmount(e.target.value)}
                  placeholder="0"
                />
              </label>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
            }}
          >
            {direction !== 'TRANSFER' && (
            <label style={field}>
              Category
              <select style={selectControl} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— Select —</option>
                {categoriesForDirection.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            )}
            <label style={field}>
              Description
              <input
                style={control}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional note"
              />
            </label>
          </div>
            </div>

            {direction !== 'TRANSFER' && (
              <aside className="finance-tx-form-split__alloc" style={{ minWidth: 0 }}>
                <FinanceAllocationEditor
                  allocations={allocations}
                  onChange={setAllocations}
                  txAmount={Number(amount) || 0}
                  excludeTransactionId={editingId}
                  priorCredits={priorCredits}
                />
              </aside>
            )}
          </div>

          {error && (
            <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.8125rem' }} role="alert">
              {error}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              paddingTop: 16,
              marginTop: 4,
              borderTop: `1px solid ${BORDER}`,
            }}
          >
            <button type="button" onClick={reset} style={btnGhost} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              style={btnPrimary}
              disabled={
                saving ||
                !accountId ||
                !paidThroughAccountId ||
                (direction === 'TRANSFER' && !transferToAccountId)
              }
            >
              {saving ? 'Saving…' : editingId ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
  )

  return (
    <div>
      {showForm ? (
        <section ref={formRef} className="finance-tx-panel">
          <div className="finance-tx-panel__top">
            <div>
              <h2 className="finance-tx-panel__title">
                {editingId ? 'Edit transaction' : 'Record transaction'}
              </h2>
              <p className="finance-tx-panel__sub">Add a new income or expense transaction</p>
            </div>
            <Link href="/admin/finance/transactions" className="finance-tx-panel__close">
              Close
            </Link>
          </div>
          <div className="finance-tx-panel__body">{txForm}</div>
        </section>
      ) : null}

      <div className="finance-tx-list">
        <div className="finance-tx-list__filters">
          <div className="finance-tx-list__search">
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                display: 'flex',
              }}
            >
              <SearchIcon />
            </span>
            <input
              style={{ ...control, paddingLeft: 36 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search description, contact, orders…"
            />
          </div>

          <FilterMultiSelect
            label="Flow"
            value={dirFilters}
            onChange={onDirFiltersChange}
            options={[
              { id: 'INFLOW', label: 'Inflow' },
              { id: 'OUTFLOW', label: 'Outflow' },
              { id: 'TRANSFER', label: 'Transfer' },
            ]}
          />

          <FilterMultiSelect
            label="Handled by"
            value={handledFilters}
            onChange={setHandledFilters}
            options={accountFilterOptions}
          />

          <FilterMultiSelect
            label="Bank used"
            value={bankFilters}
            onChange={setBankFilters}
            options={accountFilterOptions}
          />

          <FilterMultiSelect
            label="Category"
            value={categoryFilters}
            onChange={setCategoryFilters}
            options={categoryFilterOptions.map((c) => ({
              id: c.id,
              label:
                dirFilters.length === 0
                  ? `${c.name} (${c.direction === 'INFLOW' ? 'In' : 'Out'})`
                  : c.name,
            }))}
          />

          {filtersActive ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="finance-tx-list__clear"
              style={{
                ...btnGhost,
                padding: '8px 14px',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
                color: '#032b24',
                borderColor: '#b7d4cb',
                background: '#f3f8f6',
                fontWeight: 600,
              }}
            >
              Clear all filters
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setShowAllColumns((v) => !v)}
            className="finance-tx-list__cols"
            style={{
              ...btnGhost,
              padding: '8px 14px',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
            }}
            aria-pressed={showAllColumns}
          >
            <span className="finance-tx-list__cols-full">
              {showAllColumns ? 'Hide extra columns' : 'Show all columns'}
            </span>
            <span className="finance-tx-list__cols-short" aria-hidden>
              {showAllColumns ? 'Hide cols' : 'All cols'}
            </span>
          </button>

          {!showForm ? (
            <Link
              href="/admin/finance/transactions?compose=1"
              className="finance-tx-open-cta finance-tx-open-cta--inline"
              title="Add a new income or expense transaction"
              aria-label="Record transaction"
            >
              <span className="finance-tx-open-cta__plus" aria-hidden>
                +
              </span>
              <span className="finance-tx-open-cta__text">
                <span className="finance-tx-open-cta__title">
                  <span className="finance-tx-open-cta__label-full">Record transaction</span>
                  <span className="finance-tx-open-cta__label-short">Record</span>
                </span>
                <span className="finance-tx-open-cta__sub">Add a new income or expense transaction</span>
              </span>
            </Link>
          ) : null}
        </div>

        {filterTotals.count > 0 ? (
          <div className="finance-tx-totals" role="status" aria-live="polite">
            <div className="finance-tx-totals__grid">
              <div className="finance-tx-totals__count">
                <span>Totals</span>
                <strong>
                  {filterTotals.count} txn{filterTotals.count === 1 ? '' : 's'}
                  {filterTotals.count !== rows.length ? ' · filtered' : ''}
                </strong>
              </div>
              <div>
                <span>Inflow</span>
                <strong>{inr(filterTotals.inflow)}</strong>
              </div>
              <div>
                <span>Outflow</span>
                <strong>{inr(filterTotals.outflow)}</strong>
              </div>
              <div>
                <span>Transfer</span>
                <strong>{inr(filterTotals.transfer)}</strong>
              </div>
              <div title="Inflow − outflow; transfers count To as + and From as − (bank filter uses matching legs only)">
                <span>Net (in − out ± xfer)</span>
                <strong>{inr(filterTotals.net)}</strong>
              </div>
              <div>
                <span>GST</span>
                <strong>{inr(filterTotals.gst)}</strong>
              </div>
            </div>
          </div>
        ) : null}

        <div className="finance-tx-list__scroll">
          <table className="finance-tx-list__table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f7f7f5', textAlign: 'left' }}>
                {showAllColumns && sortTh('id', 'Transaction ID')}
                {sortTh('date', 'Date')}
                {sortTh('direction', 'Flow')}
                {showAllColumns && sortTh('source', 'Source')}
                {sortTh('handled', 'Handled by')}
                {sortTh('amount', 'Amount', 'right')}
                {sortTh('gst', 'GST', 'right')}
                {sortTh('bank', 'Bank / transfer')}
                {sortTh('category', 'Category')}
                {sortTh('contact', 'Contact')}
                {sortTh('description', 'Description')}
                {sortTh('allocation', 'Allocation')}
                <th style={th}>Allocated to</th>
                {sortTh('review', 'Review status')}
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const allocs = r.allocations ?? []
                const isOut = r.direction === 'OUTFLOW'
                const isTransfer = r.direction === 'TRANSFER'
                const dirLabel = isTransfer ? 'Transfer' : isOut ? 'Out' : 'In'
                const dirBg = isTransfer ? '#eef2ff' : isOut ? '#fce8e8' : GREEN_CHIP
                const dirColor = isTransfer ? '#3730a3' : isOut ? '#9f1239' : GREEN
                return (
                  <tr key={r.id} style={{ background: '#fff' }}>
                    {showAllColumns && (
                      <td
                        style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}
                        title={r.id}
                      >
                        {shortFinanceId(r.id)}
                      </td>
                    )}
                    <td style={td}>{toDateInput(new Date(r.date))}</td>
                    <td style={td}>
                      <span
                        style={{
                          display: 'inline-block',
                          borderRadius: 999,
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: dirBg,
                          color: dirColor,
                        }}
                      >
                        {dirLabel}
                      </span>
                    </td>
                    {showAllColumns && (
                      <td style={td}>
                        <span
                          style={{
                            display: 'inline-block',
                            borderRadius: 6,
                            padding: '3px 8px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: r.autoCreated ? '#fff7ed' : '#f3f4f6',
                            color: r.autoCreated ? '#9a3412' : '#4b5563',
                          }}
                        >
                          {r.autoCreated ? 'Auto-created' : 'Manual'}
                        </span>
                      </td>
                    )}
                    <td style={td}>{r.accountName ?? r.accountId}</td>
                    <td style={{ ...td, fontWeight: 600, textAlign: 'right' }}>{inr(r.amount)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{r.gstAmount ? inr(r.gstAmount) : '—'}</td>
                    <td style={td}>
                      {isTransfer
                        ? `${r.paidThroughAccountName ?? '—'} → ${r.transferToAccountName ?? '—'}`
                        : (r.paidThroughAccountName ?? r.paidThroughAccountId)}
                    </td>
                    <td style={td}>{r.categoryName || '—'}</td>
                    <td style={td}>{r.contactName || '—'}</td>
                    <td
                      style={{
                        ...td,
                        maxWidth: 180,
                        color: r.description ? '#374151' : MUTED,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={r.description || undefined}
                    >
                      {r.description || '—'}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {isTransfer ? (
                        '—'
                      ) : (
                        (() => {
                          const status = r.allocationStatus ?? (allocs.length === 0 ? 'unallocated' : 'allocated')
                          const left = r.unallocatedAmount ?? 0
                          const over = r.overAllocatedAmount ?? 0
                          const bg =
                            status === 'allocated'
                              ? GREEN_CHIP
                              : status === 'partial'
                                ? '#fffbeb'
                                : status === 'over_allocated'
                                  ? '#eff6ff'
                                  : '#f3f4f6'
                          const color =
                            status === 'allocated'
                              ? GREEN
                              : status === 'partial'
                                ? '#b45309'
                                : status === 'over_allocated'
                                  ? '#1d4ed8'
                                  : MUTED
                          const detail =
                            status === 'partial' && left > 0.009
                              ? ` · ${inr(left)} left`
                              : status === 'over_allocated' && over > 0.009
                                ? ` · ${inr(over)} over`
                                : ''
                          return (
                            <span
                              style={{
                                display: 'inline-block',
                                borderRadius: 6,
                                padding: '3px 8px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: bg,
                                color,
                              }}
                            >
                              {TX_ALLOCATION_LABEL[status]}
                              {detail}
                            </span>
                          )
                        })()
                      )}
                    </td>
                    <td style={{ ...td, maxWidth: 240 }}>
                      {allocs.length === 0 ? (
                        '—'
                      ) : (
                        allocs.map((a, i) => (
                          <span key={a.id ?? `${a.label}-${i}`}>
                            {i > 0 ? ', ' : null}
                            {a.href ? (
                              <Link
                                href={a.href}
                                style={{ color: GREEN, fontWeight: 500, textDecoration: 'underline' }}
                              >
                                {a.label}
                              </Link>
                            ) : (
                              a.label
                            )}
                            <span style={{ color: MUTED, fontSize: '0.75rem' }}>
                              {' '}
                              ({inr(a.amount)})
                            </span>
                          </span>
                        ))
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <select
                        aria-label="Review status"
                        value={r.reviewComplete ? 'reviewed' : 'for_review'}
                        onChange={(e) =>
                          void setReviewStatus(r.id, e.target.value === 'reviewed')
                        }
                        style={{
                          ...selectControl,
                          width: 'auto',
                          minWidth: 120,
                          padding: '6px 28px 6px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: r.reviewComplete ? GREEN : '#b45309',
                          backgroundColor: r.reviewComplete ? GREEN_CHIP : '#fffbeb',
                          borderColor: r.reviewComplete ? '#b7d4cb' : '#fcd34d',
                        }}
                      >
                        <option value="for_review">For review</option>
                        <option value="reviewed">Reviewed</option>
                      </select>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link
                          href={`/admin/finance/transactions?edit=${r.id}`}
                          style={{ ...actionBtn, textDecoration: 'none', display: 'inline-block' }}
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => void remove(r.id)}
                          style={{ ...actionBtn, color: MUTED, borderColor: 'transparent' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={tableColSpan} style={{ padding: 24, color: MUTED, textAlign: 'center' }}>
                    {rows.length === 0 ? 'No transactions yet.' : 'No transactions match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: '10px 16px',
            borderTop: `1px solid ${BORDER}`,
            fontSize: '0.75rem',
            color: MUTED,
          }}
        >
          {filteredRows.length === rows.length
            ? `${rows.length} transaction${rows.length === 1 ? '' : 's'}`
            : `${filteredRows.length} of ${rows.length} transactions`}
        </div>
      </div>
    </div>
  )
}

