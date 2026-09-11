'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toDateInput, shortFinanceId, type FinanceCategoryDirection, type FinanceTransactionDirection } from '@/lib/finance'
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

export type TxAccount = { id: string; name: string }
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

export function FinanceTransactionsManager({
  initial,
  accounts,
  contacts,
  categories,
  defaultAccountId,
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
  const fallbackAccountId = defaultAccountId ?? accounts[0]?.id ?? ''
  const [rows, setRows] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(editId)
  const formRef = useRef<HTMLElement>(null)
  const [date, setDate] = useState(() => toDateInput(new Date()))
  const [direction, setDirection] = useState<FinanceTransactionDirection>('OUTFLOW')
  const [amount, setAmount] = useState('')
  const [gstAmount, setGstAmount] = useState('')
  const [description, setDescription] = useState('')
  const [accountId, setAccountId] = useState(fallbackAccountId)
  const [paidThroughAccountId, setPaidThroughAccountId] = useState(fallbackAccountId)
  const [transferToAccountId, setTransferToAccountId] = useState(
    () => accounts.find((a) => a.id !== fallbackAccountId)?.id ?? '',
  )
  const [categoryId, setCategoryId] = useState('')
  const [contactId, setContactId] = useState<string | null>(null)
  const [contactText, setContactText] = useState('')
  const [contactOpen, setContactOpen] = useState(false)
  const contactWrapRef = useRef<HTMLDivElement>(null)
  const [allocations, setAllocations] = useState<AllocDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [dirFilter, setDirFilter] = useState<'ALL' | 'INFLOW' | 'OUTFLOW' | 'TRANSFER'>('ALL')
  const [handledFilter, setHandledFilter] = useState('')
  const [bankFilter, setBankFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showAllColumns, setShowAllColumns] = useState(false)

  const showForm = compose || !!editId || !!editingId
  const tableColSpan = showAllColumns ? 14 : 12

  const contactSuggestions = useMemo(() => {
    const q = contactText.trim().toLowerCase()
    if (!q) return contacts.slice(0, 8)
    return contacts.filter((c) => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)).slice(0, 8)
  }, [contactText, contacts])

  const categoriesForDirection = useMemo(
    () => (direction === 'TRANSFER' ? [] : categories.filter((c) => c.direction === direction)),
    [categories, direction],
  )

  const categoryFilterOptions = useMemo(() => {
    if (dirFilter === 'ALL') return categories
    if (dirFilter === 'TRANSFER') return []
    return categories.filter((c) => c.direction === dirFilter)
  }, [categories, dirFilter])

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
      if (!transferToAccountId || transferToAccountId === paidThroughAccountId) {
        setTransferToAccountId(accounts.find((a) => a.id !== paidThroughAccountId)?.id ?? '')
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
      if (dirFilter !== 'ALL' && r.direction !== dirFilter) return false
      if (handledFilter && r.accountId !== handledFilter) return false
      if (bankFilter && r.paidThroughAccountId !== bankFilter && r.transferToAccountId !== bankFilter)
        return false
      if (categoryFilter && r.categoryId !== categoryFilter) return false
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
  }, [rows, query, dirFilter, handledFilter, bankFilter, categoryFilter])

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
    setTransferToAccountId(
      row.transferToAccountId ??
        accounts.find((a) => a.id !== row.paidThroughAccountId)?.id ??
        '',
    )
    setCategoryId(row.categoryId ?? '')
    setContactId(row.contactId)
    setContactText(row.contactName ?? '')
    setContactOpen(false)
    setAllocations(allocationsFromRow(row))
    setError('')
  }

  function leaveForm() {
    setEditingId(null)
    setDate(toDateInput(new Date()))
    setDirection('OUTFLOW')
    setAmount('')
    setGstAmount('')
    setDescription('')
    setAccountId(fallbackAccountId)
    setPaidThroughAccountId(fallbackAccountId)
    setTransferToAccountId(accounts.find((a) => a.id !== fallbackAccountId)?.id ?? '')
    setCategoryId('')
    setContactId(null)
    setContactText('')
    setContactOpen(false)
    setAllocations([])
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
      setAccountId(fallbackAccountId)
      setPaidThroughAccountId(fallbackAccountId)
      setTransferToAccountId(accounts.find((a) => a.id !== fallbackAccountId)?.id ?? '')
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

  const filterChip = (active: boolean): React.CSSProperties => ({
    border: `1px solid ${active ? GREEN : BORDER}`,
    background: active ? GREEN_CHIP : '#fff',
    color: active ? GREEN : '#374151',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  })

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
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
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
                        setTransferToAccountId(accounts.find((a) => a.id !== from)?.id ?? '')
                      }
                    }}
                    required
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
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
                    {accounts
                      .filter((a) => a.id !== paidThroughAccountId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
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
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
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
                <option value="">— None —</option>
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
      {!showForm ? (
        <Link href="/admin/finance/transactions?compose=1" className="finance-tx-open-cta">
          <span className="finance-tx-open-cta__plus" aria-hidden>
            +
          </span>
          <span className="finance-tx-open-cta__text">
            <span className="finance-tx-open-cta__title">Record transaction</span>
            <span className="finance-tx-open-cta__sub">Add a new income or expense transaction</span>
          </span>
        </Link>
      ) : (
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
      )}

      <div
        style={{
          background: '#fff',
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180, maxWidth: 360 }}>
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

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(
              [
                ['ALL', 'All'],
                ['INFLOW', 'Inflow'],
                ['OUTFLOW', 'Outflow'],
                ['TRANSFER', 'Transfer'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setDirFilter(value)
                  setCategoryFilter((prev) => {
                    if (!prev || value === 'ALL' || value === 'TRANSFER') return value === 'TRANSFER' ? '' : prev
                    const cat = categories.find((c) => c.id === prev)
                    return cat && cat.direction === value ? prev : ''
                  })
                }}
                style={filterChip(dirFilter === value)}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            style={{ ...selectControl, width: 'auto', minWidth: 140 }}
            value={handledFilter}
            onChange={(e) => setHandledFilter(e.target.value)}
            aria-label="Filter by who handled"
          >
            <option value="">Handled by: All</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            style={{ ...selectControl, width: 'auto', minWidth: 140 }}
            value={bankFilter}
            onChange={(e) => setBankFilter(e.target.value)}
            aria-label="Filter by bank used"
          >
            <option value="">Bank used: All</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            style={{ ...selectControl, width: 'auto', minWidth: 140 }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">Category: All</option>
            {categoryFilterOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {dirFilter === 'ALL'
                  ? `${c.name} (${c.direction === 'INFLOW' ? 'In' : 'Out'})`
                  : c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowAllColumns((v) => !v)}
            style={{
              ...btnGhost,
              padding: '8px 14px',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
            }}
            aria-pressed={showAllColumns}
          >
            {showAllColumns ? 'Hide extra columns' : 'Show all columns'}
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f7f7f5', textAlign: 'left' }}>
                {showAllColumns && <th style={th}>Transaction ID</th>}
                <th style={th}>Date</th>
                <th style={th}>Flow</th>
                {showAllColumns && <th style={th}>Source</th>}
                <th style={th}>Handled by</th>
                <th style={th}>Amount</th>
                <th style={th}>GST</th>
                <th style={th}>Bank / transfer</th>
                <th style={th}>Category</th>
                <th style={th}>Contact</th>
                <th style={th}>Description</th>
                <th style={th}>Allocation</th>
                <th style={th}>Allocated to</th>
                <th style={th}>Review status</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
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
                    <td style={{ ...td, fontWeight: 600 }}>{inr(r.amount)}</td>
                    <td style={td}>{r.gstAmount ? inr(r.gstAmount) : '—'}</td>
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

