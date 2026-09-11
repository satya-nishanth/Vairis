'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toDateInput, shortFinanceId } from '@/lib/finance'
import { SETTLEMENT_LABEL, type SettlementStatus } from '@/lib/finance-settlement'

export type PurchaseBillRow = {
  id: string
  billNumber: string
  date: string
  dateInput: string
  supplierContactId: string | null
  supplierName: string
  description: string
  gstAmount: number
  totalAmount: number
  notes: string
  lines: { id?: string; description: string; amount: number }[]
  attachments: { id?: string; url: string; fileName: string; contentType: string }[]
  paid: number
  balance: number
  paymentStatus: SettlementStatus
  label: string
}

type ContactOpt = { id: string; name: string; type: string }

const GREEN = '#032b24'
const BORDER = '#e5e7eb'
const MUTED = '#6b7280'
const LABEL = '#374151'

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

const field: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: LABEL,
}

function statusStyle(s: SettlementStatus): React.CSSProperties {
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

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

type SortKey = 'date' | 'bill' | 'supplier' | 'total' | 'paid' | 'balance' | 'status'
type SortDir = 'asc' | 'desc'

const STATUS_SORT_ORDER: Record<SettlementStatus, number> = {
  unpaid: 0,
  partial: 1,
  settled: 2,
  overpaid: 3,
}

const SORTABLE_COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'date', label: 'Date' },
  { key: 'bill', label: 'Bill' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'total', label: 'Total' },
  { key: 'paid', label: 'Paid' },
  { key: 'balance', label: 'Balance' },
  { key: 'status', label: 'Status' },
]

function compareBills(a: PurchaseBillRow, b: PurchaseBillRow, key: SortKey): number {
  switch (key) {
    case 'date':
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    case 'bill':
      return (a.billNumber || a.id).localeCompare(b.billNumber || b.id, undefined, { sensitivity: 'base' })
    case 'supplier':
      return a.supplierName.localeCompare(b.supplierName, undefined, { sensitivity: 'base' })
    case 'total':
      return a.totalAmount - b.totalAmount
    case 'paid':
      return a.paid - b.paid
    case 'balance':
      return a.balance - b.balance
    case 'status':
      return STATUS_SORT_ORDER[a.paymentStatus] - STATUS_SORT_ORDER[b.paymentStatus]
  }
}

export function PurchaseBillsManager({
  initial,
  contacts,
  compose = false,
  editId = null,
}: {
  initial: PurchaseBillRow[]
  contacts: ContactOpt[]
  compose?: boolean
  editId?: string | null
}) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(editId)
  const [date, setDate] = useState(() => toDateInput(new Date()))
  const [billNumber, setBillNumber] = useState('')
  const [supplierContactId, setSupplierContactId] = useState<string | null>(null)
  const [supplierText, setSupplierText] = useState('')
  const [description, setDescription] = useState('')
  const [gstAmount, setGstAmount] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<{ key: string; description: string; amount: string }[]>([])
  const [attachments, setAttachments] = useState<
    { key: string; url: string; fileName: string; contentType: string }[]
  >([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SettlementStatus>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const fileRef = useRef<HTMLInputElement>(null)

  const showForm = compose || !!editingId

  const vendors = useMemo(
    () => contacts.filter((c) => c.type === 'VENDOR' || c.type === 'OTHER'),
    [contacts],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter((r) => {
      if (statusFilter !== 'all' && r.paymentStatus !== statusFilter) return false
      if (!q) return true
      return (
        r.billNumber.toLowerCase().includes(q) ||
        r.supplierName.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      )
    })
    const dir = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const cmp = compareBills(a, b, sortKey)
      if (cmp !== 0) return cmp * dir
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [rows, query, statusFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'date' || key === 'total' || key === 'paid' || key === 'balance' ? 'desc' : 'asc')
  }

  function resetForm() {
    setEditingId(null)
    setDate(toDateInput(new Date()))
    setBillNumber('')
    setSupplierContactId(null)
    setSupplierText('')
    setDescription('')
    setGstAmount('')
    setTotalAmount('')
    setNotes('')
    setLines([])
    setAttachments([])
    setError('')
  }

  function loadRow(r: PurchaseBillRow) {
    setEditingId(r.id)
    setDate(r.dateInput || toDateInput(new Date(r.date)))
    setBillNumber(r.billNumber)
    setSupplierContactId(r.supplierContactId)
    setSupplierText(r.supplierName)
    setDescription(r.description)
    setGstAmount(r.gstAmount ? String(r.gstAmount) : '')
    setTotalAmount(String(r.totalAmount))
    setNotes(r.notes)
    setLines(
      r.lines.map((l, i) => ({
        key: l.id ?? `l${i}`,
        description: l.description,
        amount: String(l.amount),
      })),
    )
    setAttachments(
      r.attachments.map((a, i) => ({
        key: a.id ?? `a${i}`,
        url: a.url,
        fileName: a.fileName,
        contentType: a.contentType,
      })),
    )
    setError('')
  }

  useEffect(() => {
    if (!editId) return
    const row = initial.find((r) => r.id === editId)
    if (row) loadRow(row)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot from URL once
  }, [editId])

  function sumLines() {
    return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  }

  function applyLinesAsTotal() {
    const sum = sumLines()
    if (sum > 0) setTotalAmount(String(Math.round(sum * 100) / 100))
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setError('')
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.set('file', file)
        const res = await fetch('/api/admin/finance/upload', { method: 'POST', body: fd })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'Upload failed')
        setAttachments((prev) => [
          ...prev,
          {
            key: `u:${json.url}`,
            url: json.url,
            fileName: json.fileName ?? file.name,
            contentType: json.contentType ?? file.type,
          },
        ])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const total = Number(totalAmount)
    if (!(total > 0)) {
      setError('Total amount is required')
      return
    }
    setSaving(true)
    const body = {
      date,
      billNumber: billNumber.trim(),
      supplierContactId,
      supplierName: supplierText.trim(),
      description: description.trim(),
      gstAmount: Number(gstAmount || 0),
      totalAmount: total,
      notes: notes.trim(),
      lines: lines
        .map((l) => ({ description: l.description.trim(), amount: Number(l.amount) }))
        .filter((l) => l.amount > 0),
      attachments: attachments.map((a) => ({
        url: a.url,
        fileName: a.fileName,
        contentType: a.contentType,
      })),
    }
    try {
      const res = await fetch(
        editingId ? `/api/admin/finance/purchase-bills/${editingId}` : '/api/admin/finance/purchase-bills',
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
      router.push('/admin/finance/purchase-bills')
      router.refresh()
      setRows((rs) => {
        if (id) return rs.map((r) => (r.id === id ? json : r))
        return [json, ...rs]
      })
      resetForm()
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this purchase bill?')) return
    const res = await fetch(`/api/admin/finance/purchase-bills/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Delete failed')
      return
    }
    setRows((rs) => rs.filter((r) => r.id !== id))
    if (editingId === id) resetForm()
    router.refresh()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>Purchase bills</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: MUTED }}>
            Supplier invoices — settle via Transactions allocations
          </p>
        </div>
        {!showForm ? (
          <Link
            href="/admin/finance/purchase-bills?compose=1"
            style={{
              ...control,
              width: 'auto',
              background: GREEN,
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            New bill
          </Link>
        ) : (
          <button type="button" onClick={() => { resetForm(); router.push('/admin/finance/purchase-bills') }} style={{ ...control, width: 'auto' }}>
            Close
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={save}
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            background: '#fff',
            display: 'grid',
            gap: 14,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <label style={field}>
              <span>
                Date{'\u00a0'}
                <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} style={control} />
            </label>
            <label style={field}>
              Bill number
              <input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} style={control} placeholder="Supplier invoice #" />
            </label>
            <label style={field}>
              <span>
                Total (INR){'\u00a0'}
                <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <input
                inputMode="decimal"
                required
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                style={control}
              />
            </label>
            <label style={field}>
              GST portion
              <input inputMode="decimal" value={gstAmount} onChange={(e) => setGstAmount(e.target.value)} style={control} />
            </label>
          </div>

          <label style={field}>
            Supplier
            <input
              list="purchase-bill-suppliers"
              value={supplierText}
              onChange={(e) => {
                setSupplierText(e.target.value)
                const hit = vendors.find((c) => c.name === e.target.value)
                setSupplierContactId(hit?.id ?? null)
              }}
              style={control}
              placeholder="Vendor name"
            />
            <datalist id="purchase-bill-suppliers">
              {vendors.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </label>

          <label style={field}>
            Description
            <input value={description} onChange={(e) => setDescription(e.target.value)} style={control} />
          </label>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: LABEL }}>Line items (optional)</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() =>
                    setLines((prev) => [...prev, { key: `n${Date.now()}`, description: '', amount: '' }])
                  }
                  style={{ ...control, width: 'auto', padding: '6px 12px', fontSize: '0.8125rem' }}
                >
                  Add line
                </button>
                {lines.length > 0 && (
                  <button
                    type="button"
                    onClick={applyLinesAsTotal}
                    style={{ ...control, width: 'auto', padding: '6px 12px', fontSize: '0.8125rem' }}
                  >
                    Use lines as total
                  </button>
                )}
              </div>
            </div>
            {lines.map((l) => (
              <div key={l.key} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 36px', gap: 8, marginBottom: 8 }}>
                <input
                  value={l.description}
                  onChange={(e) =>
                    setLines((prev) => prev.map((x) => (x.key === l.key ? { ...x, description: e.target.value } : x)))
                  }
                  placeholder="Gold / diamonds / making…"
                  style={control}
                />
                <input
                  inputMode="decimal"
                  value={l.amount}
                  onChange={(e) =>
                    setLines((prev) => prev.map((x) => (x.key === l.key ? { ...x, amount: e.target.value } : x)))
                  }
                  placeholder="Amount"
                  style={control}
                />
                <button
                  type="button"
                  aria-label="Remove line"
                  onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                  style={{ ...control, padding: 0 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: LABEL }}>Attachments</span>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                style={{ ...control, width: 'auto', padding: '6px 12px', fontSize: '0.8125rem' }}
              >
                {uploading ? 'Uploading…' : 'Upload PDF / image'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                hidden
                onChange={(e) => void uploadFiles(e.target.files)}
              />
            </div>
            {attachments.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: MUTED }}>No attachments yet</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.875rem' }}>
                {attachments.map((a) => (
                  <li key={a.key} style={{ marginBottom: 4 }}>
                    <a href={a.url} target="_blank" rel="noreferrer" style={{ color: GREEN }}>
                      {a.fileName}
                    </a>{' '}
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((x) => x.key !== a.key))}
                      style={{ border: 'none', background: 'none', color: MUTED, cursor: 'pointer' }}
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label style={field}>
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={control} />
          </label>

          {error && <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.875rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={saving} style={{ ...control, width: 'auto', background: GREEN, color: '#fff', border: 'none', fontWeight: 600 }}>
              {saving ? 'Saving…' : editingId ? 'Update bill' : 'Create bill'}
            </button>
            <button type="button" onClick={() => { resetForm(); router.push('/admin/finance/purchase-bills') }} style={{ ...control, width: 'auto' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search bills…"
          style={{ ...control, maxWidth: 280 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          style={{ ...control, width: 'auto' }}
        >
          <option value="all">All statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="settled">Settled</option>
          <option value="overpaid">Overpaid</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
              {SORTABLE_COLUMNS.map((col) => {
                const active = sortKey === col.key
                const arrow = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
                return (
                  <th key={col.key} style={{ padding: '10px 12px', fontSize: '0.75rem', color: MUTED, fontWeight: 600 }}>
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      aria-label={`Sort by ${col.label}${active ? `, ${sortDir}ending` : ''}`}
                      style={{
                        border: 'none',
                        background: 'none',
                        padding: 0,
                        margin: 0,
                        cursor: 'pointer',
                        font: 'inherit',
                        fontWeight: 600,
                        color: active ? GREEN : MUTED,
                        letterSpacing: 'inherit',
                      }}
                    >
                      {col.label}
                      {arrow}
                    </button>
                  </th>
                )
              })}
              <th style={{ padding: '10px 12px', fontSize: '0.75rem', color: MUTED, fontWeight: 600 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 24, color: MUTED, textAlign: 'center' }}>
                  No purchase bills yet
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{toDateInput(new Date(r.date))}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 500 }}>{r.billNumber || shortFinanceId(r.id)}</div>
                    {r.description ? <div style={{ color: MUTED, fontSize: '0.75rem' }}>{r.description}</div> : null}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{r.supplierName || '—'}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{inr(r.totalAmount)}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{inr(r.paid)}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{inr(r.balance)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={statusStyle(r.paymentStatus)}>{SETTLEMENT_LABEL[r.paymentStatus]}</span>
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <button type="button" onClick={() => loadRow(r)} style={{ border: 'none', background: 'none', color: GREEN, cursor: 'pointer', fontWeight: 500 }}>
                      Edit
                    </button>
                    {' · '}
                    <Link href={`/admin/finance/transactions?compose=1`} style={{ color: GREEN }}>
                      Pay
                    </Link>
                    {' · '}
                    <button type="button" onClick={() => void remove(r.id)} style={{ border: 'none', background: 'none', color: MUTED, cursor: 'pointer' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
