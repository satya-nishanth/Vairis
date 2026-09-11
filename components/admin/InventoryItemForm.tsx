'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { InventoryMarkSoldDialog } from '@/components/admin/InventoryMarkSoldDialog'
import { inventoryDisplayName } from '@/lib/inventory'
import { shortFinanceId } from '@/lib/finance'

export type VariantOption = {
  variantId: string
  productId: string
  label: string
  sku: string
}

export type HolderOption = { id: string; name: string }

export type InventoryBillRef = {
  id: string
  billNumber: string
  supplierName: string
  href: string | null
  dateLabel?: string
  description?: string
  totalAmount?: number
  balance?: number
  paymentStatus?: 'unpaid' | 'partial' | 'settled' | 'overpaid'
}

export type InventoryEditRow = {
  id: string
  qtyOnHand: number
  purchasePrice: number | null
  soldPrice: number | null
  potentialPrice: number | null
  customName: string | null
  customDescription: string | null
  metalPurity: string | null
  weightGrams: string | null
  diamondCarats: number | null
  stoneCarats: number | null
  notes: string | null
  holderId: string
  variantId: string | null
  product: { name: string } | null
  variant: { sku: string; metalType: string; size: string | null } | null
  purchaseBills?: InventoryBillRef[]
  allocations?: {
    id: string
    qty: number
    createdAt: string
    order: { id: string; contactName: string; status: string }
  }[]
  sales?: {
    id: string
    qty: number
    soldAt: string
    unlinkedOrderLabel: string | null
    order: { id: string; contactName: string } | null
  }[]
}

type BillSearchHit = {
  id: string
  billNumber: string
  supplierName: string
  dateInput?: string
  date?: string
  description?: string
  totalAmount?: number
  balance?: number
  paymentStatus?: 'unpaid' | 'partial' | 'settled' | 'overpaid'
  lines?: { description: string; amount: number }[]
}

const GREEN = '#032b24'
const BORDER = '#e5e7eb'
const MUTED = '#6b7280'
const AMBER = '#b45309'
const sep = {
  color: '#d1d5db',
  margin: '0 6px',
  userSelect: 'none' as const,
}

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function formatBillDate(isoOrInput: string | undefined): string {
  if (!isoOrInput) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrInput)) {
    const [y, m, d] = isoOrInput.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  const d = new Date(isoOrInput)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function billTitle(b: { billNumber: string; id: string }) {
  return b.billNumber.trim() ? `#${b.billNumber.trim()}` : `Bill ${shortFinanceId(b.id)}`
}

function billLabel(b: { billNumber: string; supplierName: string; id: string }) {
  const title = billTitle(b)
  return b.supplierName.trim() ? `${title} — ${b.supplierName}` : title
}

function billLineSummary(hit: {
  description?: string
  lines?: { description: string; amount: number }[]
}): string {
  if (hit.description?.trim()) return hit.description.trim()
  if (hit.lines && hit.lines.length > 0) {
    return hit.lines
      .map((l) => l.description.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(' · ')
  }
  return '—'
}

function billDueText(hit: {
  balance?: number
  totalAmount?: number
  paymentStatus?: string
}): { text: string; color: string } | null {
  if (hit.balance == null && hit.paymentStatus == null) return null
  const bal = hit.balance ?? hit.totalAmount ?? 0
  if (hit.paymentStatus === 'overpaid' || bal < -0.009) {
    return { text: `Overpaid ${inr(Math.abs(bal))}`, color: '#1d4ed8' }
  }
  if (hit.paymentStatus === 'settled' || Math.abs(bal) <= 0.009) {
    return { text: 'Settled', color: GREEN }
  }
  if (hit.paymentStatus === 'partial') {
    return { text: `Due ${inr(Math.max(0, bal))}`, color: AMBER }
  }
  return { text: `Due ${inr(Math.max(0, bal))}`, color: AMBER }
}

function hitToBillRef(hit: BillSearchHit): InventoryBillRef {
  return {
    id: hit.id,
    billNumber: hit.billNumber,
    supplierName: hit.supplierName,
    href: `/admin/finance/purchase-bills?edit=${encodeURIComponent(hit.id)}`,
    dateLabel: formatBillDate(hit.dateInput || hit.date),
    description: billLineSummary(hit),
    totalAmount: hit.totalAmount,
    balance: hit.balance,
    paymentStatus: hit.paymentStatus,
  }
}

export function InventoryItemForm({
  holders,
  variantOptions,
  initial,
  isFinance = false,
}: {
  holders: HolderOption[]
  variantOptions: VariantOption[]
  initial?: InventoryEditRow
  isFinance?: boolean
}) {
  const router = useRouter()
  const isEdit = Boolean(initial)
  const [source, setSource] = useState<'catalogue' | 'custom'>(
    initial ? (initial.variantId ? 'catalogue' : 'custom') : 'catalogue',
  )
  const [variantId, setVariantId] = useState(initial?.variantId ?? '')
  const [customName, setCustomName] = useState(initial?.customName ?? '')
  const [customDescription, setCustomDescription] = useState(initial?.customDescription ?? '')
  const [metalPurity, setMetalPurity] = useState(initial?.metalPurity ?? '')
  const [weightGrams, setWeightGrams] = useState(initial?.weightGrams ?? '')
  const [diamondCarats, setDiamondCarats] = useState(
    initial?.diamondCarats != null ? String(initial.diamondCarats) : '',
  )
  const [stoneCarats, setStoneCarats] = useState(
    initial?.stoneCarats != null ? String(initial.stoneCarats) : '',
  )
  const [qtyOnHand, setQtyOnHand] = useState(String(initial?.qtyOnHand ?? 1))
  const [purchasePrice, setPurchasePrice] = useState(
    initial?.purchasePrice != null ? String(initial.purchasePrice) : '',
  )
  const [soldPrice, setSoldPrice] = useState(
    initial?.soldPrice != null ? String(initial.soldPrice) : '',
  )
  const [potentialPrice, setPotentialPrice] = useState(
    initial?.potentialPrice != null ? String(initial.potentialPrice) : '',
  )
  const [holderId, setHolderId] = useState(initial?.holderId ?? holders[0]?.id ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [selectedBills, setSelectedBills] = useState<InventoryBillRef[]>(
    () => initial?.purchaseBills ?? [],
  )
  const [billQuery, setBillQuery] = useState('')
  const [billHits, setBillHits] = useState<BillSearchHit[]>([])
  const [billLoading, setBillLoading] = useState(false)
  const [linkVariantId, setLinkVariantId] = useState('')
  const [pickerSearch, setPickerSearch] = useState('')
  const [cataloguePickerOpen, setCataloguePickerOpen] = useState(false)
  const [linkPickerOpen, setLinkPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [markSoldOpen, setMarkSoldOpen] = useState(false)

  const selectedVariant = useMemo(
    () => variantOptions.find((v) => v.variantId === variantId) ?? null,
    [variantOptions, variantId],
  )

  const linkedVariant = useMemo(
    () => variantOptions.find((v) => v.variantId === linkVariantId) ?? null,
    [variantOptions, linkVariantId],
  )

  function selectCatalogueVariant(v: VariantOption) {
    setVariantId(v.variantId)
    setPickerSearch(v.label)
    setCataloguePickerOpen(false)
    setSoldPrice('')
    setError(null)
  }

  function selectLinkVariant(v: VariantOption) {
    setLinkVariantId(v.variantId)
    setPickerSearch(v.label)
    setLinkPickerOpen(false)
    setError(null)
  }

  const filteredVariants = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    if (!q) return variantOptions.slice(0, 80)
    return variantOptions
      .filter(
        (v) =>
          v.label.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q),
      )
      .slice(0, 80)
  }, [variantOptions, pickerSearch])

  const isCatalogueLinkedEdit = isEdit && Boolean(initial?.variantId)
  const showCataloguePicker = (!isEdit && source === 'catalogue') || isCatalogueLinkedEdit
  const showCustomFields = (!isEdit && source === 'custom') || (isEdit && !initial?.variantId)
  const usesCataloguePricing = showCataloguePicker && Boolean(variantId)

  useEffect(() => {
    if (!usesCataloguePricing) {
      setLivePrice(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/inventory/variant-price?variantId=${encodeURIComponent(variantId)}`,
        )
        const data = (await res.json()) as { livePrice?: number | null }
        if (!cancelled) {
          setLivePrice(res.ok && data.livePrice != null ? data.livePrice : null)
        }
      } catch {
        if (!cancelled) setLivePrice(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [variantId, usesCataloguePricing])

  useEffect(() => {
    if (!isFinance) return
    const q = billQuery.trim()
    const t = setTimeout(() => {
      void (async () => {
        setBillLoading(true)
        try {
          const url =
            q.length >= 2
              ? `/api/admin/finance/purchase-bills?q=${encodeURIComponent(q)}`
              : `/api/admin/finance/purchase-bills`
          const res = await fetch(url)
          const json = (await res.json().catch(() => [])) as BillSearchHit[]
          setBillHits(Array.isArray(json) ? json.slice(0, 40) : [])
        } catch {
          setBillHits([])
        } finally {
          setBillLoading(false)
        }
      })()
    }, q.length >= 2 ? 250 : 0)
    return () => clearTimeout(t)
  }, [billQuery, isFinance])

  function parseOptionalNumber(raw: string): number | null {
    if (raw.trim() === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : NaN
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (showCataloguePicker && !variantId) {
      setError('Select a catalogue variant')
      return
    }
    setSaving(true)
    setError(null)
    const parsedPurchase = parseOptionalNumber(purchasePrice)
    const parsedSold = parseOptionalNumber(soldPrice)
    const parsedPotential = parseOptionalNumber(potentialPrice)
    const parsedDiamond = parseOptionalNumber(diamondCarats)
    const parsedStone = parseOptionalNumber(stoneCarats)
    if (
      (parsedPurchase != null && (!Number.isFinite(parsedPurchase) || parsedPurchase <= 0)) ||
      (parsedSold != null && (!Number.isFinite(parsedSold) || parsedSold <= 0)) ||
      (parsedPotential != null && (!Number.isFinite(parsedPotential) || parsedPotential <= 0)) ||
      (parsedDiamond != null && (!Number.isFinite(parsedDiamond) || parsedDiamond < 0)) ||
      (parsedStone != null && (!Number.isFinite(parsedStone) || parsedStone < 0))
    ) {
      setError('Enter valid prices and carat values')
      setSaving(false)
      return
    }

    const financeFields = isFinance
      ? {
          purchasePrice: parsedPurchase,
          potentialPrice: parsedPotential,
          purchaseBillIds: selectedBills.map((b) => b.id),
        }
      : {}

    const caratFields = {
      diamondCarats: parsedDiamond,
      stoneCarats: parsedStone,
    }

    try {
      const body = isEdit
        ? isCatalogueLinkedEdit
          ? {
              variantId,
              qtyOnHand: Number(qtyOnHand),
              soldPrice: parsedSold,
              holderId,
              notes: notes || null,
              ...caratFields,
              ...financeFields,
            }
          : {
              customName,
              customDescription: customDescription || null,
              metalPurity: metalPurity || null,
              weightGrams: weightGrams ? Number(weightGrams) : null,
              qtyOnHand: Number(qtyOnHand),
              soldPrice: parsedSold,
              holderId,
              notes: notes || null,
              ...(linkVariantId ? { linkVariantId } : {}),
              ...caratFields,
              ...financeFields,
            }
        : {
            source,
            variantId: source === 'catalogue' ? variantId : undefined,
            customName: source === 'custom' ? customName : undefined,
            customDescription: customDescription || undefined,
            metalPurity: metalPurity || undefined,
            weightGrams: weightGrams ? Number(weightGrams) : undefined,
            qtyOnHand: Number(qtyOnHand),
            soldPrice: parsedSold,
            holderId,
            notes: notes || undefined,
            ...caratFields,
            ...financeFields,
          }

      const res = await fetch(
        isEdit ? `/api/admin/inventory/items/${initial!.id}` : '/api/admin/inventory/items',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? `Could not save (${res.status})`)
        return
      }
      router.push('/admin/inventory')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!initial || !confirm('Delete this inventory line?')) return
    const res = await fetch(`/api/admin/inventory/items/${initial.id}`, { method: 'DELETE' })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setError(data.error ?? `Could not delete (${res.status})`)
      return
    }
    router.push('/admin/inventory')
    router.refresh()
  }

  const listBills = useMemo(() => {
    const hitById = new Map(billHits.map((h) => [h.id, hitToBillRef(h)]))
    const selectedRows = selectedBills.map((b) => {
      const fromHit = hitById.get(b.id)
      if (!fromHit) return b
      return {
        ...b,
        ...fromHit,
        href: b.href ?? fromHit.href,
      }
    })
    const extras = billHits
      .filter((h) => !selectedBills.some((b) => b.id === h.id))
      .map(hitToBillRef)
    return [...selectedRows, ...extras]
  }, [billHits, selectedBills])

  function toggleBill(bill: InventoryBillRef | BillSearchHit) {
    const next = 'href' in bill && bill.href !== undefined ? (bill as InventoryBillRef) : hitToBillRef(bill)
    setSelectedBills((prev) => {
      if (prev.some((b) => b.id === next.id)) return prev.filter((b) => b.id !== next.id)
      return [...prev, next]
    })
  }

  return (
    <form onSubmit={submit} className="inv-card">
      {isEdit && initial && !initial.variantId && (
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 0 }}>
          Custom line{initial.customName ? `: ${initial.customName}` : ''}. Link a catalogue variant
          below to sell via manual orders.
        </p>
      )}

      {!isEdit && (
        <div className="inv-field">
          <label>Source</label>
          <div className="orders-wb__filter-row" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={source === 'catalogue' ? 'orders-wb__chip is-active' : 'orders-wb__chip'}
              onClick={() => setSource('catalogue')}
            >
              Catalogue
            </button>
            <button
              type="button"
              className={source === 'custom' ? 'orders-wb__chip is-active' : 'orders-wb__chip'}
              onClick={() => setSource('custom')}
            >
              Custom
            </button>
          </div>
        </div>
      )}

      {showCataloguePicker && (
        <>
          <div className="inv-field">
            <label>Catalogue variant</label>
            {selectedVariant && !cataloguePickerOpen ? (
              <div className="inv-picker-selected">
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{selectedVariant.label}</div>
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  style={{ padding: '6px 10px', fontSize: '0.75rem', flexShrink: 0 }}
                  onClick={() => {
                    setCataloguePickerOpen(true)
                    setPickerSearch('')
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <input
                value={pickerSearch}
                onChange={(e) => {
                  setPickerSearch(e.target.value)
                  setCataloguePickerOpen(true)
                }}
                onFocus={() => setCataloguePickerOpen(true)}
                placeholder="Search catalogue…"
                autoComplete="off"
              />
            )}
            {cataloguePickerOpen && (
              <div className="inv-picker" style={{ marginTop: 8 }}>
                {filteredVariants.length === 0 ? (
                  <p style={{ padding: '12px 10px', margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>
                    No products match.
                  </p>
                ) : (
                  filteredVariants.map((v) => (
                    <button
                      key={v.variantId}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectCatalogueVariant(v)}
                    >
                      <span>{v.label}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      {showCustomFields && (
        <>
          <div className="inv-field">
            <label>Item name</label>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              required
              placeholder="e.g. 22K custom kada"
            />
          </div>
          <div className="inv-field">
            <label>Description (optional)</label>
            <textarea
              rows={2}
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="inv-field">
              <label>Metal purity (optional)</label>
              <input
                value={metalPurity}
                onChange={(e) => setMetalPurity(e.target.value)}
                placeholder="22K"
              />
            </div>
            <div className="inv-field">
              <label>Weight (g, optional)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={weightGrams}
                onChange={(e) => setWeightGrams(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <div className="inv-field">
          <label>Diamond carats (optional)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={diamondCarats}
            onChange={(e) => setDiamondCarats(e.target.value)}
            placeholder="e.g. 0.45"
          />
        </div>
        <div className="inv-field">
          <label>Other stone carats (optional)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={stoneCarats}
            onChange={(e) => setStoneCarats(e.target.value)}
            placeholder="e.g. 1.2"
          />
        </div>
      </div>

      {isEdit && !initial?.variantId && (
        <div className="inv-field" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
          <label>Link to catalogue (optional)</label>
          {linkedVariant && !linkPickerOpen ? (
            <div className="inv-picker-selected">
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{linkedVariant.label}</div>
                <p style={{ fontSize: '0.75rem', color: '#047857', margin: '4px 0 0' }}>
                  Will link on save — item becomes sellable via manual orders.
                </p>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                style={{ padding: '6px 10px', fontSize: '0.75rem', flexShrink: 0 }}
                onClick={() => {
                  setLinkPickerOpen(true)
                  setPickerSearch('')
                  setLinkVariantId('')
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <input
              value={pickerSearch}
              onChange={(e) => {
                setPickerSearch(e.target.value)
                setLinkPickerOpen(true)
                if (linkVariantId) setLinkVariantId('')
              }}
              onFocus={() => setLinkPickerOpen(true)}
              placeholder="Search to link…"
              autoComplete="off"
            />
          )}
          {linkPickerOpen && !linkedVariant && (
            <div className="inv-picker" style={{ marginTop: 8 }}>
              {filteredVariants.length === 0 ? (
                <p style={{ padding: '12px 10px', margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>
                  No products match.
                </p>
              ) : (
                filteredVariants.slice(0, 40).map((v) => (
                  <button
                    key={v.variantId}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectLinkVariant(v)}
                  >
                    <span>{v.label}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isFinance ? '1fr 1fr 1fr 1fr 1fr' : '1fr 1fr 1fr',
          gap: 12,
          marginTop: 12,
        }}
      >
        <div className="inv-field">
          <label>Quantity on hand</label>
          <input
            type="number"
            min={0}
            max={9999}
            required
            value={qtyOnHand}
            onChange={(e) => setQtyOnHand(e.target.value)}
          />
        </div>
        {isFinance && (
          <>
            <div className="inv-field">
              <label>Purchase price (₹, optional)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="Cost per piece"
              />
            </div>
            <div className="inv-field">
              <label>Potential price (₹, optional)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={potentialPrice}
                onChange={(e) => setPotentialPrice(e.target.value)}
                placeholder="Expected sale price"
              />
              {usesCataloguePricing && (
                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '4px 0 0' }}>
                  {potentialPrice.trim() === ''
                    ? livePrice != null
                      ? `Header uses live ₹${livePrice.toLocaleString('en-IN')}, then purchase`
                      : 'Header falls back to purchase when unset'
                    : 'Used for inventory header valuation'}
                </p>
              )}
            </div>
          </>
        )}
        <div className="inv-field">
          <label>
            {usesCataloguePricing
              ? 'Sold price override (₹, optional)'
              : 'Sold price (₹, optional)'}
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={soldPrice}
            onChange={(e) => setSoldPrice(e.target.value)}
            placeholder={usesCataloguePricing ? 'Leave blank for live price' : 'e.g. 85000'}
          />
          {usesCataloguePricing && (
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '4px 0 0' }}>
              {livePrice != null
                ? soldPrice.trim() === ''
                  ? `Using live catalogue sold price: ₹${livePrice.toLocaleString('en-IN')}`
                  : `Live catalogue price: ₹${livePrice.toLocaleString('en-IN')} — your entry overrides this`
                : 'Live sold price unavailable — enter a price or check gold rates'}
            </p>
          )}
        </div>
        <div className="inv-field">
          <label>Holder</label>
          <select required value={holderId} onChange={(e) => setHolderId(e.target.value)}>
            {holders.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="inv-field" style={{ marginTop: 12 }}>
        <label>Purchase invoices</label>
        {!isFinance ? (
          selectedBills.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>None tagged</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8125rem' }}>
              {selectedBills.map((b) => (
                <li key={b.id}>{billLabel(b)}</li>
              ))}
            </ul>
          )
        ) : (
          <>
            <input
              value={billQuery}
              onChange={(e) => setBillQuery(e.target.value)}
              placeholder="Search bill # or supplier…"
              autoComplete="off"
            />
            {billLoading ? (
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: MUTED }}>Loading…</p>
            ) : null}
            {listBills.length === 0 && !billLoading ? (
              <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: '#9ca3af' }}>
                {billQuery.trim().length >= 2 ? 'No matching invoices' : 'None tagged — search to add'}
              </p>
            ) : (
              <ul
                style={{
                  margin: '8px 0 0',
                  padding: 0,
                  listStyle: 'none',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  background: '#fff',
                  maxHeight: 360,
                  overflowY: 'auto',
                }}
              >
                {listBills.map((bill, i) => {
                  const selected = selectedBills.some((b) => b.id === bill.id)
                  const due = billDueText(bill)
                  const title = billTitle(bill)
                  const contact = bill.supplierName.trim() || '—'
                  const dateLabel = bill.dateLabel || '—'
                  const itemLabel = bill.description?.trim() || '—'
                  return (
                    <li
                      key={bill.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '28px minmax(0, 1fr)',
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
                        onChange={() => toggleBill(bill)}
                        aria-label={`Tag ${title}`}
                        style={{ width: 16, height: 16, accentColor: GREEN }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleBill(bill)}
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
                          <span style={{ fontWeight: 700 }}>{title}</span>
                          <span style={sep}>·</span>
                          <span style={{ color: MUTED }}>{dateLabel}</span>
                          <span style={sep}>·</span>
                          <span style={{ fontWeight: 600 }}>{contact}</span>
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
                            title={itemLabel}
                          >
                            {itemLabel}
                          </span>
                          {bill.totalAmount != null ? (
                            <>
                              <span style={sep}>·</span>
                              <span>Bill {inr(bill.totalAmount)}</span>
                            </>
                          ) : null}
                          {due ? (
                            <>
                              <span style={sep}>·</span>
                              <span style={{ fontWeight: 600, color: due.color }}>{due.text}</span>
                            </>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="inv-field">
        <label>Notes (optional)</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {isEdit && initial?.sales && initial.sales.length > 0 && (
        <div style={{ marginTop: 16, fontSize: '0.8125rem' }}>
          <strong>Marked sold</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {initial.sales.map((s) => (
              <li key={s.id}>
                {s.qty} unit(s) on {new Date(s.soldAt).toLocaleDateString('en-IN')} →{' '}
                {s.order ? (
                  <a href={`/admin/orders/${s.order.id}`}>{s.order.contactName}</a>
                ) : (
                  <span>
                    {s.unlinkedOrderLabel}{' '}
                    <span style={{ color: '#9ca3af' }}>(not linked)</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isEdit && initial?.allocations && initial.allocations.length > 0 && (
        <div style={{ marginTop: 16, fontSize: '0.8125rem' }}>
          <strong>Order allocations</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {initial.allocations.map((a) => (
              <li key={a.id}>
                {a.qty} unit(s) →{' '}
                <a href={`/admin/orders/${a.order.id}`}>
                  {a.order.contactName} ({a.order.status})
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginTop: 12 }} role="alert">
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button type="submit" className="admin-btn" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add inventory'}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          onClick={() => router.push('/admin/inventory')}
        >
          Cancel
        </button>
        {isEdit && initial && initial.qtyOnHand > 0 && (
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => setMarkSoldOpen(true)}
          >
            Mark sold
          </button>
        )}
        {isEdit && (
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            style={{ color: '#b91c1c', marginLeft: 'auto' }}
            onClick={() => void remove()}
          >
            Delete
          </button>
        )}
      </div>

      {isEdit && initial && markSoldOpen && (
        <InventoryMarkSoldDialog
          itemId={initial.id}
          itemLabel={inventoryDisplayName(initial)}
          qtyOnHand={initial.qtyOnHand}
          open
          onClose={() => {
            setMarkSoldOpen(false)
            router.refresh()
          }}
        />
      )}
    </form>
  )
}
