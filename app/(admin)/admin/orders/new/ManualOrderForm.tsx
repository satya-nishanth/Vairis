'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type VariantOption = {
  variantId: string
  productId: string
  category: string
  productName: string
  itemCode: string
  sku: string
  label: string
  suggestedPrice: number
}
type Customer = { id: string; email: string; name: string; mobile: string | null }
type Line = {
  variantId: string
  quantity: number
  unitPrice: number
  inventoryItemId?: string
  maxQty?: number
  fromInventory?: boolean
}

const CATEGORIES = [
  { key: 'ALL', label: 'All' },
  { key: 'RINGS', label: 'Rings' },
  { key: 'EARRINGS', label: 'Earrings' },
  { key: 'PENDANTS', label: 'Pendants' },
  { key: 'BRACELETS', label: 'Bracelets' },
  { key: 'NECKLACES', label: 'Necklaces' },
] as const

const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  padding: '8px 10px',
  fontSize: '0.8125rem',
}
const label: React.CSSProperties = {
  display: 'block',
  fontSize: '0.6875rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#6b7280',
  margin: '12px 0 4px',
}
const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  padding: '1.25rem',
  marginBottom: '1rem',
}

type Quotation = {
  id: string
  displayId: string
  orderType: string
  details: string | null
  customerName: string | null
  customerMobile: string | null
  screenshotUrls: string[]
} | null

export function ManualOrderForm({
  variantOptions,
  quotation = null,
}: {
  variantOptions: VariantOption[]
  quotation?: Quotation
}) {
  const router = useRouter()

  // Customer search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)

  // Address / contact — prefilled from the quotation when converting one, still fully editable.
  // The quotation's customerName/customerMobile are NOT a User account (see Task 13) — only the
  // contact fields prefill; the admin still searches/picks the real customer account above.
  const [address, setAddress] = useState({
    contactName: quotation?.customerName ?? '',
    contactPhone: quotation?.customerMobile ?? '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
  })

  // Item picker
  const [itemMode, setItemMode] = useState<'catalogue' | 'inventory'>('catalogue')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['key']>('ALL')
  const [itemSearch, setItemSearch] = useState('')
  const [inventoryOptions, setInventoryOptions] = useState<
    {
      inventoryItemId: string
      variantId: string
      qtyOnHand: number
      holderName: string
      label: string
      suggestedPrice: number
    }[]
  >([])
  const [inventoryLoaded, setInventoryLoaded] = useState(false)

  // Lines + settlement
  const [lines, setLines] = useState<Line[]>([])
  const [paid, setPaid] = useState(true)
  const [paymentNote, setPaymentNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredVariants = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    return variantOptions
      .filter((v) => (category === 'ALL' ? true : v.category === category))
      .filter((v) => {
        if (!q) return true
        return (
          v.productName.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q) ||
          v.itemCode.toLowerCase().includes(q) ||
          v.label.toLowerCase().includes(q)
        )
      })
      .slice(0, 80)
  }, [variantOptions, category, itemSearch])

  const categoryCounts = useMemo(() => {
    // Count unique products per category (not variant rows)
    const byCat = new Map<string, Set<string>>()
    const all = new Set<string>()
    for (const v of variantOptions) {
      all.add(v.productId)
      if (!byCat.has(v.category)) byCat.set(v.category, new Set())
      byCat.get(v.category)!.add(v.productId)
    }
    const counts: Record<string, number> = { ALL: all.size }
    for (const [cat, set] of byCat) counts[cat] = set.size
    return counts
  }, [variantOptions])

  async function search(q: string) {
    setQuery(q)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`)
    if (res.ok) setResults(await res.json())
  }

  function pickCustomer(c: Customer) {
    setCustomer(c)
    setResults([])
    setQuery(c.email)
    setAddress((a) => ({
      ...a,
      contactName: a.contactName || c.name,
      contactPhone: a.contactPhone || (c.mobile ?? ''),
    }))
  }

  function addLine(variantId: string) {
    const opt = variantOptions.find((v) => v.variantId === variantId)
    if (!opt) return
    setLines((ls) => [...ls, { variantId, quantity: 1, unitPrice: opt.suggestedPrice }])
    setItemSearch('')
  }

  async function ensureInventoryLoaded() {
    if (inventoryLoaded) return
    const res = await fetch('/api/admin/inventory/available')
    if (res.ok) {
      setInventoryOptions(await res.json())
      setInventoryLoaded(true)
    }
  }

  function switchItemMode(mode: 'catalogue' | 'inventory') {
    setItemMode(mode)
    if (mode === 'inventory') void ensureInventoryLoaded()
  }

  function addInventoryLine(row: (typeof inventoryOptions)[number]) {
    setLines((ls) => [
      ...ls,
      {
        variantId: row.variantId,
        quantity: 1,
        unitPrice: row.suggestedPrice,
        inventoryItemId: row.inventoryItemId,
        maxQty: row.qtyOnHand,
        fromInventory: true,
      },
    ])
    setItemSearch('')
  }

  const filteredInventory = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    return inventoryOptions.filter((r) => {
      if (!q) return true
      return (
        r.label.toLowerCase().includes(q) ||
        r.holderName.toLowerCase().includes(q)
      )
    })
  }, [inventoryOptions, itemSearch])

  const total = Math.round(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0))
  const grandTotal = total
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) {
      setError('Select a customer first')
      return
    }
    if (lines.length === 0) {
      setError('Add at least one item')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: customer.id,
          ...address,
          initialStatus: paid ? 'PAYMENT_CONFIRMED' : 'PAYMENT_PENDING',
          paymentNote: paymentNote || undefined,
          items: lines.map(({ variantId, quantity, unitPrice, inventoryItemId }) => ({
            variantId,
            quantity,
            unitPrice,
            inventoryItemId,
          })),
          quotationId: quotation?.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not create order')
        return
      }
      router.push(`/admin/orders/${data.orderId}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      {quotation && (
        <div style={{ ...card, background: '#f8fafc', borderStyle: 'dashed' }}>
          <strong style={{ fontSize: '0.875rem' }}>Converting {quotation.displayId}</strong>
          <p style={{ fontSize: '0.8125rem', margin: '8px 0 0' }}>
            <strong>Type:</strong> {quotation.orderType}
          </p>
          {quotation.details && (
            <p style={{ fontSize: '0.8125rem', margin: '4px 0 0' }}>
              <strong>Details:</strong> {quotation.details}
            </p>
          )}
          {quotation.screenshotUrls.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {quotation.screenshotUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="Quote screenshot" style={{ width: 80, height: 80, objectFit: 'cover' }} />
              ))}
            </div>
          )}
        </div>
      )}

      <div style={card}>
        <strong style={{ fontSize: '0.875rem' }}>1 · Customer</strong>
        <label style={label}>Search by email or name</label>
        <input
          style={input}
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="customer@email.com"
        />
        {results.length > 0 && (
          <div style={{ border: '1px solid #e5e7eb', borderTop: 'none' }}>
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCustomer(c)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  fontSize: '0.8125rem',
                  background: '#fff',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                }}
              >
                {c.name} — {c.email}
              </button>
            ))}
          </div>
        )}
        {customer && (
          <p style={{ marginTop: 8, fontSize: '0.8125rem', color: '#15803d' }}>
            ✓ {customer.name} ({customer.email})
          </p>
        )}
      </div>

      <div style={card}>
        <strong style={{ fontSize: '0.875rem' }}>2 · Items</strong>

        <div className="inv-tabs" style={{ marginTop: 10 }}>
          <button
            type="button"
            className={itemMode === 'catalogue' ? 'is-active' : undefined}
            onClick={() => switchItemMode('catalogue')}
          >
            From catalogue
          </button>
          <button
            type="button"
            className={itemMode === 'inventory' ? 'is-active' : undefined}
            onClick={() => switchItemMode('inventory')}
          >
            From inventory
          </button>
        </div>

        {itemMode === 'catalogue' ? (
          <>
        <label style={label}>Category</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CATEGORIES.map((c) => {
            const active = category === c.key
            const count = categoryCounts[c.key] ?? 0
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                style={{
                  padding: '6px 10px',
                  fontSize: '0.6875rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: active ? '1px solid #032b24' : '1px solid #e5e7eb',
                  background: active ? '#032b24' : '#fff',
                  color: active ? '#fff' : '#4b5563',
                }}
              >
                {c.label}
                <span style={{ marginLeft: 4, opacity: 0.75 }}>{count}</span>
              </button>
            )
          })}
        </div>

        <label style={label}>Search product / SKU / item code</label>
        <input
          style={input}
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
          placeholder="e.g. solitaire, VR-R-012, SKU…"
        />

        <div
          style={{
            marginTop: 8,
            border: '1px solid #e5e7eb',
            maxHeight: 260,
            overflowY: 'auto',
            background: '#fafafa',
          }}
        >
          {filteredVariants.length === 0 ? (
            <p style={{ padding: '12px 10px', fontSize: '0.8125rem', color: '#9ca3af', margin: 0 }}>
              No variants match — try another category or search.
            </p>
          ) : (
            filteredVariants.map((v) => (
              <button
                key={v.variantId}
                type="button"
                onClick={() => addLine(v.variantId)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 10px',
                  fontSize: '0.8125rem',
                  background: '#fff',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                }}
              >
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#9ca3af', fontSize: '0.6875rem', marginRight: 6 }}>
                    {v.category.charAt(0) + v.category.slice(1).toLowerCase()}
                  </span>
                  {v.label}
                </span>
                <span style={{ flexShrink: 0, color: '#032b24', fontWeight: 500 }}>{inr(v.suggestedPrice)}</span>
              </button>
            ))
          )}
        </div>
        {itemSearch.trim() === '' && filteredVariants.length === 80 && (
          <p style={{ margin: '6px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>
            Showing first 80 — pick a category or type to narrow further.
          </p>
        )}
          </>
        ) : (
          <>
            <label style={label}>Search inventory</label>
            <input
              style={input}
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Product name, SKU, holder…"
            />
            <div
              style={{
                marginTop: 8,
                border: '1px solid #e5e7eb',
                maxHeight: 260,
                overflowY: 'auto',
                background: '#fafafa',
              }}
            >
              {!inventoryLoaded ? (
                <p style={{ padding: '12px 10px', fontSize: '0.8125rem', color: '#9ca3af', margin: 0 }}>
                  Loading available stock…
                </p>
              ) : filteredInventory.length === 0 ? (
                <p style={{ padding: '12px 10px', fontSize: '0.8125rem', color: '#9ca3af', margin: 0 }}>
                  No linked inventory in stock — add items under Inventory and link them to the catalogue.
                </p>
              ) : (
                filteredInventory.map((r) => (
                  <button
                    key={r.inventoryItemId}
                    type="button"
                    onClick={() => addInventoryLine(r)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 10px',
                      fontSize: '0.8125rem',
                      background: '#fff',
                      border: 'none',
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <div>{r.label}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                        {r.qtyOnHand} @ {r.holderName}
                      </div>
                    </span>
                    <span style={{ flexShrink: 0, color: '#032b24', fontWeight: 500 }}>{inr(r.suggestedPrice)}</span>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {lines.map((line, idx) => {
          const opt = variantOptions.find((v) => v.variantId === line.variantId)
          const labelText = opt?.label ?? 'Item'
          const maxQ = line.fromInventory && line.maxQty ? line.maxQty : 20
          return (
            <div
              key={idx}
              style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: '0.8125rem', flexWrap: 'wrap' }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {labelText}
                {line.fromInventory && (
                  <span className="inv-line-badge" style={{ marginLeft: 6 }}>
                    inventory
                  </span>
                )}
              </span>
              <input
                type="number"
                min={1}
                max={maxQ}
                value={line.quantity}
                onChange={(e) =>
                  setLines((ls) =>
                    ls.map((l, i) =>
                      i === idx ? { ...l, quantity: Math.min(maxQ, Math.max(1, Number(e.target.value))) } : l,
                    ),
                  )
                }
                style={{ ...input, width: 64 }}
                aria-label="Quantity"
              />
              <input
                type="number"
                min={1}
                value={line.unitPrice}
                onChange={(e) =>
                  setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, unitPrice: Number(e.target.value) } : l)))
                }
                style={{ ...input, width: 130 }}
                aria-label="Unit price (₹)"
              />
              <button
                type="button"
                onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                style={{ border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer' }}
                aria-label="Remove line"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <div style={card}>
        <strong style={{ fontSize: '0.875rem' }}>3 · Delivery</strong>
        <label style={label}>Contact name</label>
        <input style={input} required value={address.contactName} onChange={(e) => setAddress((a) => ({ ...a, contactName: e.target.value }))} />
        <label style={label}>Mobile (10 digits)</label>
        <input style={input} required pattern="\d{10}" value={address.contactPhone} onChange={(e) => setAddress((a) => ({ ...a, contactPhone: e.target.value }))} />
        <label style={label}>Address line 1</label>
        <input style={input} required value={address.addressLine1} onChange={(e) => setAddress((a) => ({ ...a, addressLine1: e.target.value }))} />
        <label style={label}>Address line 2 (optional)</label>
        <input style={input} value={address.addressLine2} onChange={(e) => setAddress((a) => ({ ...a, addressLine2: e.target.value }))} />
        <div className="admin-grid-3">
          <div>
            <label style={label}>City</label>
            <input style={input} required value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} />
          </div>
          <div>
            <label style={label}>State</label>
            <input style={input} required value={address.state} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))} />
          </div>
          <div>
            <label style={label}>Pincode</label>
            <input style={input} required pattern="\d{6}" value={address.pincode} onChange={(e) => setAddress((a) => ({ ...a, pincode: e.target.value }))} />
          </div>
        </div>
      </div>

      <div style={card}>
        <strong style={{ fontSize: '0.875rem' }}>4 · Settlement</strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', margin: '10px 0 0' }}>
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          Payment already received (UPI / bank transfer)
        </label>
        <label style={label}>Payment reference note (shown on the order timeline)</label>
        <input style={input} value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="e.g. GPay ref 402398765432" />

        <div style={{ marginTop: 16, fontSize: '0.875rem', borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
          <p>Goods total: {inr(total)}</p>
          <p style={{ fontWeight: 600 }}>Customer pays: {inr(grandTotal)}</p>
        </div>
      </div>

      {error && (
        <p style={{ fontSize: '0.8125rem', color: '#b91c1c', background: '#fef2f2', padding: '8px 12px', border: '1px solid #fecaca', marginBottom: 12 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '10px 28px',
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          background: '#032b24',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {saving ? 'Creating…' : 'Create Order'}
      </button>
    </form>
  )
}
