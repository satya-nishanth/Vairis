'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ACCOUNT_TYPE_LABEL,
  VENDOR_OUTFLOW_SOURCE_LABEL,
  VENDOR_OUTFLOW_SOURCE_TIP,
  type VendorOutflowSource,
} from '@/lib/finance'
import type { FinanceAccountType } from '@prisma/client'
import { FinanceCollapsible } from '@/components/admin/FinanceCollapsible'

export type AccountRow = {
  id: string
  name: string
  email: string | null
  type: FinanceAccountType
  isVendorWallet: boolean
  vendorOutflowSource: VendorOutflowSource
  active: boolean
  sortOrder: number
}

const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  padding: '8px 10px',
  fontSize: '0.8125rem',
}

const TYPES: FinanceAccountType[] = ['PARTNER', 'COMPANY_BANK', 'CASH', 'VENDOR', 'OTHER']
const OUTFLOW_SOURCES: VendorOutflowSource[] = ['ORDER_SHEETS', 'TRANSACTIONS', 'BOTH']

function isVendorAccount(row: Pick<AccountRow, 'type' | 'isVendorWallet'>) {
  return row.type === 'VENDOR' || row.isVendorWallet
}

function OutflowSourceTip() {
  return (
    <span className="finance-dash__kpi-tip" style={{ position: 'relative', top: 0, right: 0 }}>
      <button
        type="button"
        className="finance-dash__kpi-info"
        aria-label="About dashboard outflow source"
      >
        i
      </button>
      <span className="finance-dash__kpi-tip-text" role="tooltip">
        {VENDOR_OUTFLOW_SOURCE_TIP}
      </span>
    </span>
  )
}

function AccountTable({
  rows,
  showOutflowSource,
  onEdit,
  onDeactivate,
}: {
  rows: AccountRow[]
  showOutflowSource?: boolean
  onEdit: (row: AccountRow) => void
  onDeactivate: (id: string) => void
}) {
  if (rows.length === 0) {
    return <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '8px 0' }}>None yet.</p>
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', background: '#fff' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
          <th style={{ padding: 8 }}>Account</th>
          <th style={{ padding: 8 }}>Email</th>
          <th style={{ padding: 8 }}>Type</th>
          {showOutflowSource && <th style={{ padding: 8 }}>Dashboard outflow</th>}
          <th style={{ padding: 8 }}>Status</th>
          <th style={{ padding: 8 }} />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: r.active ? 1 : 0.55 }}>
            <td style={{ padding: 8 }}>{r.name}</td>
            <td style={{ padding: 8 }}>{r.email ?? '—'}</td>
            <td style={{ padding: 8 }}>{ACCOUNT_TYPE_LABEL[r.type]}</td>
            {showOutflowSource && (
              <td style={{ padding: 8 }}>{VENDOR_OUTFLOW_SOURCE_LABEL[r.vendorOutflowSource]}</td>
            )}
            <td style={{ padding: 8 }}>{r.active ? 'Active' : 'Inactive'}</td>
            <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
              <button type="button" className="admin-btn" onClick={() => onEdit(r)}>
                Edit
              </button>{' '}
              {r.active && (
                <button type="button" className="admin-btn" onClick={() => onDeactivate(r.id)}>
                  Deactivate
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function FinanceAccountsManager({ initial }: { initial: AccountRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [type, setType] = useState<FinanceAccountType>('PARTNER')
  const [isVendorWallet, setIsVendorWallet] = useState(false)
  const [vendorOutflowSource, setVendorOutflowSource] = useState<VendorOutflowSource>('ORDER_SHEETS')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const companyAccounts = useMemo(() => rows.filter((r) => !isVendorAccount(r)), [rows])
  const vendorWallets = useMemo(() => rows.filter((r) => isVendorAccount(r)), [rows])
  const showVendorFields = type === 'VENDOR' || isVendorWallet

  function load(row: AccountRow) {
    setEditingId(row.id)
    setName(row.name)
    setEmail(row.email ?? '')
    setType(row.type)
    setIsVendorWallet(row.type === 'VENDOR' || row.isVendorWallet)
    setVendorOutflowSource(row.vendorOutflowSource)
    setActive(row.active)
    setError('')
  }

  function reset() {
    setEditingId(null)
    setName('')
    setEmail('')
    setType('PARTNER')
    setIsVendorWallet(false)
    setVendorOutflowSource('ORDER_SHEETS')
    setActive(true)
    setError('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const nextType = type
    const nextIsVendor = nextType === 'VENDOR' || isVendorWallet
    const body = {
      name,
      email: email.trim() || null,
      type: nextType,
      isVendorWallet: nextIsVendor,
      ...(nextIsVendor ? { vendorOutflowSource } : {}),
      active,
    }
    try {
      const res = await fetch(
        editingId ? `/api/admin/finance/accounts/${editingId}` : '/api/admin/finance/accounts',
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
      reset()
      router.refresh()
      setRows((rs) => {
        if (id) return rs.map((r) => (r.id === id ? json : r))
        return [...rs, json].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      })
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this account?')) return
    const res = await fetch(`/api/admin/finance/accounts/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return
    setRows((rs) => rs.map((r) => (r.id === id ? json : r)))
    router.refresh()
  }

  return (
    <div>
      <FinanceCollapsible title={editingId ? 'Edit account' : 'Add account'} forceOpen={!!editingId}>
        <form onSubmit={save} style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
          <label style={{ fontSize: '0.75rem' }}>
            Name
            <input style={input} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label style={{ fontSize: '0.75rem' }}>
            Email (login match for default)
            <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label style={{ fontSize: '0.75rem' }}>
            Type
            <select
              style={input}
              value={type}
              onChange={(e) => {
                const next = e.target.value as FinanceAccountType
                setType(next)
                setIsVendorWallet(next === 'VENDOR')
              }}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          {showVendorFields && (
            <label style={{ fontSize: '0.75rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Dashboard outflow from
                <OutflowSourceTip />
              </span>
              <select
                style={input}
                value={vendorOutflowSource}
                onChange={(e) => setVendorOutflowSource(e.target.value as VendorOutflowSource)}
              >
                {OUTFLOW_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {VENDOR_OUTFLOW_SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label style={{ fontSize: '0.75rem', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
          {error && <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.8125rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="admin-btn" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Add account'}
            </button>
            {editingId && (
              <button type="button" className="admin-btn" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </FinanceCollapsible>

      <h3 style={{ margin: '16px 0 8px', fontSize: '0.8125rem', fontWeight: 700, color: '#032b24' }}>
        Accounts
      </h3>
      <AccountTable rows={companyAccounts} onEdit={load} onDeactivate={deactivate} />

      <h3 style={{ margin: '20px 0 8px', fontSize: '0.8125rem', fontWeight: 700, color: '#032b24' }}>
        Vendor wallets
      </h3>
      <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#6b7280' }}>
        Accounts with type Vendor. Shown under By account → Vendor wallets on the dashboard. Choose
        whether outflow comes from order-sheet purchase price, cashbook outflows, or both.
        Transactions-only vendors are hidden from order-sheet “Purchase from”.
      </p>
      <AccountTable
        rows={vendorWallets}
        showOutflowSource
        onEdit={load}
        onDeactivate={deactivate}
      />
    </div>
  )
}
