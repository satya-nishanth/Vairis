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

/** Selling components stored on OrderItem.priceBreakdown (not finance purchase). */
const SELLING_FIELDS = [
  { key: 'gold', label: 'Gold' },
  { key: 'diamonds', label: 'Diamonds' },
  { key: 'stones', label: 'Stones' },
  { key: 'making', label: 'Making charges' },
  { key: 'wastage', label: 'Wastage' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'gst', label: 'GST' },
] as const

type SellingKey = (typeof SELLING_FIELDS)[number]['key']
type SellingBreakdown = Record<SellingKey, string>

function emptySelling(): SellingBreakdown {
  return {
    gold: '',
    diamonds: '',
    stones: '',
    making: '',
    wastage: '',
    delivery: '',
    gst: '',
  }
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

type InventoryOption = {
  inventoryItemId: string
  variantId: string
  qtyOnHand: number
  holderName: string
  label: string
  suggestedPrice: number
}

type HolderOption = { id: string; name: string }

export function ManualOrderForm({
  variantOptions,
  holders,
  quotation = null,
  isFinance = false,
}: {
  variantOptions: VariantOption[]
  holders: HolderOption[]
  quotation?: Quotation
  isFinance?: boolean
}) {
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', mobile: '' })
  const [creatingCustomer, setCreatingCustomer] = useState(false)

  const [address, setAddress] = useState({
    contactName: quotation?.customerName ?? '',
    contactPhone: quotation?.customerMobile ?? '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
  })

  const [itemMode, setItemMode] = useState<'catalogue' | 'inventory'>('catalogue')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['key']>('ALL')
  const [itemSearch, setItemSearch] = useState('')
  const [inventoryOptions, setInventoryOptions] = useState<InventoryOption[]>([])
  const [inventoryLoaded, setInventoryLoaded] = useState(false)
  const [showNewInventory, setShowNewInventory] = useState(false)
  const [creatingInventory, setCreatingInventory] = useState(false)
  const [invVariantSearch, setInvVariantSearch] = useState('')
  const [newInventory, setNewInventory] = useState({
    variantId: '',
    holderId: holders[0]?.id ?? '',
    qty: '1',
    purchasePrice: '',
    potentialPrice: '',
  })

  const [lines, setLines] = useState<Line[]>([])
  const [paid, setPaid] = useState(true)
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentReceivedAt, setPaymentReceivedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selling, setSelling] = useState<SellingBreakdown>(emptySelling)

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

  const invCreateVariants = useMemo(() => {
    const q = invVariantSearch.trim().toLowerCase()
    if (!q) return [] as VariantOption[]
    return variantOptions
      .filter(
        (v) =>
          v.productName.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q) ||
          v.itemCode.toLowerCase().includes(q) ||
          v.label.toLowerCase().includes(q),
      )
      .slice(0, 40)
  }, [variantOptions, invVariantSearch])

  const selectedInvVariant = useMemo(
    () => variantOptions.find((v) => v.variantId === newInventory.variantId) ?? null,
    [variantOptions, newInventory.variantId],
  )

  const categoryCounts = useMemo(() => {
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

  const sellingParsed = useMemo(() => {
    const out = {
      gold: 0,
      diamonds: 0,
      stones: 0,
      making: 0,
      wastage: 0,
      delivery: 0,
      gst: 0,
    }
    for (const f of SELLING_FIELDS) {
      const raw = selling[f.key].trim()
      out[f.key] = raw === '' ? 0 : Number(raw)
    }
    return out
  }, [selling])

  const sellingTotal = useMemo(
    () =>
      sellingParsed.gold +
      sellingParsed.diamonds +
      sellingParsed.stones +
      sellingParsed.making +
      sellingParsed.wastage +
      sellingParsed.delivery +
      sellingParsed.gst,
    [sellingParsed],
  )
  const hasSellingBreakdown = sellingTotal > 0

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
    setShowNewCustomer(false)
    setAddress((a) => ({
      ...a,
      contactName: a.contactName || c.name,
      contactPhone: a.contactPhone || (c.mobile ?? ''),
    }))
  }

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    const name = newCustomer.name.trim()
    const email = newCustomer.email.trim()
    const mobile = newCustomer.mobile.trim()
    if (name.length < 2) {
      setError('Enter customer name')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email')
      return
    }
    if (mobile && !/^\d{10}$/.test(mobile)) {
      setError('Mobile must be 10 digits')
      return
    }
    setCreatingCustomer(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, mobile: mobile || undefined }),
      })
      const data = await res.json()
      if (res.status === 409 && data.user) {
        pickCustomer(data.user as Customer)
        setNewCustomer({ name: '', email: '', mobile: '' })
        return
      }
      if (!res.ok) {
        setError(data.error ?? 'Could not create customer')
        return
      }
      pickCustomer(data as Customer)
      setNewCustomer({ name: '', email: '', mobile: '' })
    } finally {
      setCreatingCustomer(false)
    }
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
    setItemSearch('')
    setShowNewInventory(false)
    if (mode === 'inventory') void ensureInventoryLoaded()
  }

  function addInventoryLine(row: InventoryOption) {
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
    setShowNewInventory(false)
  }

  async function createInventoryAndAdd(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!newInventory.variantId) {
      setError('Select a catalogue variant for the inventory item')
      return
    }
    if (!newInventory.holderId) {
      setError('Select a holder')
      return
    }
    const qty = Number(newInventory.qty)
    if (!Number.isInteger(qty) || qty < 1) {
      setError('Quantity must be a whole number ≥ 1')
      return
    }
    const purchaseRaw = isFinance ? newInventory.purchasePrice.trim() : ''
    const potentialRaw = isFinance ? newInventory.potentialPrice.trim() : ''
    const purchasePrice = purchaseRaw === '' ? null : Number(purchaseRaw)
    const potentialPrice = potentialRaw === '' ? null : Number(potentialRaw)
    if (purchasePrice != null && (!Number.isFinite(purchasePrice) || purchasePrice <= 0)) {
      setError('Invalid purchase price')
      return
    }
    if (potentialPrice != null && (!Number.isFinite(potentialPrice) || potentialPrice <= 0)) {
      setError('Invalid potential price')
      return
    }

    setCreatingInventory(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'catalogue',
          variantId: newInventory.variantId,
          holderId: newInventory.holderId,
          qtyOnHand: qty,
          ...(isFinance ? { purchasePrice, potentialPrice } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not create inventory item')
        return
      }
      const opt = variantOptions.find((v) => v.variantId === newInventory.variantId)
      const holderName = holders.find((h) => h.id === newInventory.holderId)?.name ?? ''
      const entry: InventoryOption = {
        inventoryItemId: data.id as string,
        variantId: newInventory.variantId,
        qtyOnHand: Number(data.qtyOnHand ?? qty),
        holderName,
        label: opt?.label ?? 'Inventory item',
        suggestedPrice: opt?.suggestedPrice ?? 0,
      }
      setInventoryOptions((prev) => [entry, ...prev.filter((r) => r.inventoryItemId !== entry.inventoryItemId)])
      setInventoryLoaded(true)
      addInventoryLine(entry)
      setNewInventory((n) => ({
        ...n,
        variantId: '',
        qty: '1',
        purchasePrice: '',
        potentialPrice: '',
      }))
      setInvVariantSearch('')
    } finally {
      setCreatingInventory(false)
    }
  }

  function applySellingToSingleLine() {
    if (lines.length !== 1 || sellingTotal <= 0) return
    setLines((ls) =>
      ls.map((l, i) => (i === 0 ? { ...l, unitPrice: Math.round(sellingTotal / l.quantity) } : l)),
    )
  }

  const filteredInventory = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    return inventoryOptions.filter((r) => {
      if (!q) return true
      return r.label.toLowerCase().includes(q) || r.holderName.toLowerCase().includes(q)
    })
  }, [inventoryOptions, itemSearch])

  const total = Math.round(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0))
  const grandTotal = total
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`
  const sellingMismatch = hasSellingBreakdown && Math.round(sellingTotal) !== total

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
    if (hasSellingBreakdown) {
      for (const f of SELLING_FIELDS) {
        const raw = selling[f.key].trim()
        if (raw !== '' && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
          setError(`Invalid amount for ${f.label}`)
          return
        }
      }
    }
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        userId: customer.id,
        ...address,
        initialStatus: paid ? 'PAYMENT_CONFIRMED' : 'PAYMENT_PENDING',
        paymentNote: paymentNote || undefined,
        paymentReceivedAt: paid ? paymentReceivedAt || undefined : undefined,
        items: lines.map(({ variantId, quantity, unitPrice, inventoryItemId }) => ({
          variantId,
          quantity,
          unitPrice,
          inventoryItemId,
        })),
        quotationId: quotation?.id,
      }
      if (hasSellingBreakdown) {
        body.sellingBreakdown = sellingParsed
      }

      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
                <img
                  key={url}
                  src={url}
                  alt="Quote screenshot"
                  style={{ width: 80, height: 80, objectFit: 'cover' }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div style={card}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ fontSize: '0.875rem' }}>1 · Customer</strong>
          <button
            type="button"
            onClick={() => {
              setShowNewCustomer((v) => !v)
              setError(null)
              if (!showNewCustomer && quotation) {
                setNewCustomer((n) => ({
                  name: n.name || quotation.customerName || '',
                  email: n.email,
                  mobile: n.mobile || quotation.customerMobile || '',
                }))
              }
            }}
            style={{
              border: '1px solid #032b24',
              background: showNewCustomer ? '#e8f2ef' : '#fff',
              color: '#032b24',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {showNewCustomer ? 'Search existing' : '+ New contact'}
          </button>
        </div>

        {showNewCustomer ? (
          <div style={{ marginTop: 4 }}>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 4px' }}>
              Creates a customer record for this order. They can sign in later with the same email.
            </p>
            <label style={label}>Name</label>
            <input
              style={input}
              value={newCustomer.name}
              onChange={(e) => setNewCustomer((n) => ({ ...n, name: e.target.value }))}
              placeholder="Customer name"
              autoComplete="name"
            />
            <label style={label}>Email</label>
            <input
              style={input}
              type="email"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer((n) => ({ ...n, email: e.target.value }))}
              placeholder="customer@email.com"
              autoComplete="email"
            />
            <label style={label}>Mobile (optional, 10 digits)</label>
            <input
              style={input}
              value={newCustomer.mobile}
              onChange={(e) => setNewCustomer((n) => ({ ...n, mobile: e.target.value }))}
              placeholder="9876543210"
              inputMode="numeric"
              pattern="\d{10}"
            />
            <button
              type="button"
              disabled={creatingCustomer}
              onClick={(e) => void createCustomer(e)}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                fontSize: '0.75rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: '#032b24',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {creatingCustomer ? 'Creating…' : 'Create & select'}
            </button>
            {customer && (
              <p style={{ marginTop: 8, fontSize: '0.8125rem', color: '#15803d' }}>
                ✓ {customer.name} ({customer.email})
              </p>
            )}
          </div>
        ) : (
          <>
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
          </>
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

            {itemSearch.trim() !== '' && (
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
                      <span
                        style={{
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ color: '#9ca3af', fontSize: '0.6875rem', marginRight: 6 }}>
                          {v.category.charAt(0) + v.category.slice(1).toLowerCase()}
                        </span>
                        {v.label}
                      </span>
                      <span style={{ flexShrink: 0, color: '#032b24', fontWeight: 500 }}>
                        {inr(v.suggestedPrice)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => {
                  setShowNewInventory((v) => !v)
                  setItemSearch('')
                  setError(null)
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#032b24',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {showNewInventory ? 'Search existing' : '+ New inventory'}
              </button>
            </div>

            {showNewInventory ? (
              <div
                style={{
                  marginTop: 10,
                  padding: 12,
                  border: '1px dashed #d1d5db',
                  background: '#fafafa',
                }}
              >
                <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#6b7280' }}>
                  Creates a catalogue-linked stock row, then adds it to this order.
                </p>
                {holders.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#b91c1c' }}>
                    No active holders — add one under Inventory → Holders first.
                  </p>
                ) : (
                  <>
                    <label style={label}>Catalogue variant</label>
                    <input
                      style={input}
                      value={
                        selectedInvVariant && invVariantSearch === ''
                          ? selectedInvVariant.label
                          : invVariantSearch
                      }
                      onChange={(e) => {
                        setInvVariantSearch(e.target.value)
                        setNewInventory((n) => ({ ...n, variantId: '' }))
                      }}
                      onFocus={() => {
                        if (selectedInvVariant && invVariantSearch === '') {
                          setInvVariantSearch('')
                        }
                      }}
                      placeholder="Search product / SKU…"
                    />
                    {invVariantSearch.trim() !== '' && !newInventory.variantId && (
                      <div
                        style={{
                          marginTop: 8,
                          border: '1px solid #e5e7eb',
                          maxHeight: 200,
                          overflowY: 'auto',
                          background: '#fff',
                        }}
                      >
                        {invCreateVariants.length === 0 ? (
                          <p
                            style={{
                              padding: '10px',
                              fontSize: '0.8125rem',
                              color: '#9ca3af',
                              margin: 0,
                            }}
                          >
                            No variants match.
                          </p>
                        ) : (
                          invCreateVariants.map((v) => (
                            <button
                              key={v.variantId}
                              type="button"
                              onClick={() => {
                                setNewInventory((n) => ({ ...n, variantId: v.variantId }))
                                setInvVariantSearch('')
                              }}
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
                              {v.label}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    {selectedInvVariant && (
                      <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#15803d' }}>
                        ✓ {selectedInvVariant.label}
                      </p>
                    )}

                    <label style={label}>Holder</label>
                    <select
                      style={input}
                      value={newInventory.holderId}
                      onChange={(e) => setNewInventory((n) => ({ ...n, holderId: e.target.value }))}
                    >
                      {holders.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: 10,
                      }}
                    >
                      <div>
                        <label style={label}>Qty</label>
                        <input
                          style={input}
                          inputMode="numeric"
                          value={newInventory.qty}
                          onChange={(e) => setNewInventory((n) => ({ ...n, qty: e.target.value }))}
                        />
                      </div>
                      {isFinance ? (
                        <>
                          <div>
                            <label style={label}>Purchase ₹ (optional)</label>
                            <input
                              style={input}
                              inputMode="decimal"
                              value={newInventory.purchasePrice}
                              onChange={(e) =>
                                setNewInventory((n) => ({ ...n, purchasePrice: e.target.value }))
                              }
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label style={label}>Potential ₹ (optional)</label>
                            <input
                              style={input}
                              inputMode="decimal"
                              value={newInventory.potentialPrice}
                              onChange={(e) =>
                                setNewInventory((n) => ({ ...n, potentialPrice: e.target.value }))
                              }
                              placeholder="0"
                            />
                          </div>
                        </>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      disabled={creatingInventory || !newInventory.variantId}
                      onClick={(e) => void createInventoryAndAdd(e)}
                      style={{
                        marginTop: 14,
                        padding: '8px 14px',
                        fontSize: '0.8125rem',
                        background: '#032b24',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor:
                          creatingInventory || !newInventory.variantId ? 'not-allowed' : 'pointer',
                        opacity: creatingInventory || !newInventory.variantId ? 0.6 : 1,
                      }}
                    >
                      {creatingInventory ? 'Creating…' : 'Create & add to order'}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <label style={label}>Search inventory</label>
                <input
                  style={input}
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Product name, SKU, holder…"
                />
                {itemSearch.trim() !== '' && (
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
                      <p
                        style={{
                          padding: '12px 10px',
                          fontSize: '0.8125rem',
                          color: '#9ca3af',
                          margin: 0,
                        }}
                      >
                        Loading available stock…
                      </p>
                    ) : filteredInventory.length === 0 ? (
                      <p
                        style={{
                          padding: '12px 10px',
                          fontSize: '0.8125rem',
                          color: '#9ca3af',
                          margin: 0,
                        }}
                      >
                        No stock found — use + New inventory to add a catalogue-linked item.
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
                          <span style={{ flexShrink: 0, color: '#032b24', fontWeight: 500 }}>
                            {inr(r.suggestedPrice)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {lines.map((line, idx) => {
          const opt = variantOptions.find((v) => v.variantId === line.variantId)
          const labelText = opt?.label ?? 'Item'
          const maxQ = line.fromInventory && line.maxQty ? line.maxQty : 20
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                marginTop: 10,
                fontSize: '0.8125rem',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
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
                      i === idx
                        ? { ...l, quantity: Math.min(maxQ, Math.max(1, Number(e.target.value))) }
                        : l,
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
                  setLines((ls) =>
                    ls.map((l, i) => (i === idx ? { ...l, unitPrice: Number(e.target.value) } : l)),
                  )
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
        <strong style={{ fontSize: '0.875rem' }}>3 · Selling price breakdown</strong>
        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '8px 0 0' }}>
          Optional. Saved on the order as price breakdown (gold, diamonds, wastage, delivery, GST).
          Purchase / cost stays in Finance only.
          {lines.length > 1 ? ' For multi-item orders, breakdown is stored on the first line.' : ''}
        </p>

        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '8px 6px', color: '#6b7280', fontWeight: 500 }}>Component</th>
                <th style={{ padding: '8px 6px', color: '#6b7280', fontWeight: 500 }}>
                  Selling (₹)
                </th>
              </tr>
            </thead>
            <tbody>
              {SELLING_FIELDS.map((f) => (
                <tr key={f.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 6px', fontWeight: 500 }}>{f.label}</td>
                  <td style={{ padding: '6px' }}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={selling[f.key]}
                      onChange={(e) => setSelling((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ ...input, margin: 0 }}
                      placeholder="0"
                      aria-label={`${f.label} selling`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={{ padding: '10px 6px', fontWeight: 600 }}>Total</td>
                <td style={{ padding: '10px 6px', fontWeight: 600 }}>{inr(Math.round(sellingTotal))}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {sellingMismatch && (
          <p style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 10 }}>
            Breakdown total ({inr(Math.round(sellingTotal))}) differs from goods total ({inr(total)}).
            {lines.length === 1 && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={applySellingToSingleLine}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#032b24',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '0.75rem',
                    textDecoration: 'underline',
                  }}
                >
                  Apply breakdown total to item price
                </button>
              </>
            )}
          </p>
        )}
      </div>

      <div style={card}>
        <strong style={{ fontSize: '0.875rem' }}>4 · Delivery</strong>
        <label style={label}>Contact name</label>
        <input
          style={input}
          required
          value={address.contactName}
          onChange={(e) => setAddress((a) => ({ ...a, contactName: e.target.value }))}
        />
        <label style={label}>Mobile (10 digits)</label>
        <input
          style={input}
          required
          pattern="\d{10}"
          value={address.contactPhone}
          onChange={(e) => setAddress((a) => ({ ...a, contactPhone: e.target.value }))}
        />
        <label style={label}>Address line 1</label>
        <input
          style={input}
          required
          value={address.addressLine1}
          onChange={(e) => setAddress((a) => ({ ...a, addressLine1: e.target.value }))}
        />
        <label style={label}>Address line 2 (optional)</label>
        <input
          style={input}
          value={address.addressLine2}
          onChange={(e) => setAddress((a) => ({ ...a, addressLine2: e.target.value }))}
        />
        <div className="admin-grid-3">
          <div>
            <label style={label}>City</label>
            <input
              style={input}
              required
              value={address.city}
              onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
            />
          </div>
          <div>
            <label style={label}>State</label>
            <input
              style={input}
              required
              value={address.state}
              onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
            />
          </div>
          <div>
            <label style={label}>Pincode</label>
            <input
              style={input}
              required
              pattern="\d{6}"
              value={address.pincode}
              onChange={(e) => setAddress((a) => ({ ...a, pincode: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div style={card}>
        <strong style={{ fontSize: '0.875rem' }}>5 · Settlement</strong>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.8125rem',
            margin: '10px 0 0',
          }}
        >
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          Payment already received (UPI / bank transfer)
        </label>
        {paid && (
          <>
            <label style={label}>Received On</label>
            <input
              style={input}
              type="date"
              required
              value={paymentReceivedAt}
              onChange={(e) => setPaymentReceivedAt(e.target.value)}
            />
          </>
        )}
        <label style={label}>Payment reference note (shown on the order timeline)</label>
        <input
          style={input}
          value={paymentNote}
          onChange={(e) => setPaymentNote(e.target.value)}
          placeholder="e.g. GPay ref 402398765432"
        />

        <div
          style={{
            marginTop: 16,
            fontSize: '0.875rem',
            borderTop: '1px solid #f3f4f6',
            paddingTop: 12,
          }}
        >
          <p>Goods total: {inr(total)}</p>
          <p style={{ fontWeight: 600 }}>Customer pays: {inr(grandTotal)}</p>
        </div>
      </div>

      {error && (
        <p
          style={{
            fontSize: '0.8125rem',
            color: '#b91c1c',
            background: '#fef2f2',
            padding: '8px 12px',
            border: '1px solid #fecaca',
            marginBottom: 12,
          }}
        >
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
