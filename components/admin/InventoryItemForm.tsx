'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { InventoryMarkSoldDialog } from '@/components/admin/InventoryMarkSoldDialog'
import { inventoryDisplayName } from '@/lib/inventory'

export type VariantOption = {
  variantId: string
  productId: string
  label: string
  sku: string
}

export type HolderOption = { id: string; name: string }

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
  notes: string | null
  holderId: string
  variantId: string | null
  product: { name: string } | null
  variant: { sku: string; metalType: string; size: string | null } | null
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

export function InventoryItemForm({
  holders,
  variantOptions,
  initial,
}: {
  holders: HolderOption[]
  variantOptions: VariantOption[]
  initial?: InventoryEditRow
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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (showCataloguePicker && !variantId) {
      setError('Select a catalogue variant')
      return
    }
    setSaving(true)
    setError(null)
    const parsedPurchase =
      purchasePrice.trim() === '' ? null : Number(purchasePrice)
    const parsedSold = soldPrice.trim() === '' ? null : Number(soldPrice)
    const parsedPotential = potentialPrice.trim() === '' ? null : Number(potentialPrice)
    if (
      (parsedPurchase != null && (!Number.isFinite(parsedPurchase) || parsedPurchase <= 0)) ||
      (parsedSold != null && (!Number.isFinite(parsedSold) || parsedSold <= 0)) ||
      (parsedPotential != null && (!Number.isFinite(parsedPotential) || parsedPotential <= 0))
    ) {
      setError('Enter valid purchase, potential, and sold prices')
      setSaving(false)
      return
    }
    try {
      const body = isEdit
        ? isCatalogueLinkedEdit
          ? {
              variantId,
              qtyOnHand: Number(qtyOnHand),
              purchasePrice: parsedPurchase,
              soldPrice: parsedSold,
              potentialPrice: parsedPotential,
              holderId,
              notes: notes || null,
            }
          : {
              customName,
              customDescription: customDescription || null,
              metalPurity: metalPurity || null,
              weightGrams: weightGrams ? Number(weightGrams) : null,
              qtyOnHand: Number(qtyOnHand),
              purchasePrice: parsedPurchase,
              soldPrice: parsedSold,
              potentialPrice: parsedPotential,
              holderId,
              notes: notes || null,
              ...(linkVariantId ? { linkVariantId } : {}),
            }
        : {
            source,
            variantId: source === 'catalogue' ? variantId : undefined,
            customName: source === 'custom' ? customName : undefined,
            customDescription: customDescription || undefined,
            metalPurity: metalPurity || undefined,
            weightGrams: weightGrams ? Number(weightGrams) : undefined,
            qtyOnHand: Number(qtyOnHand),
            purchasePrice: parsedPurchase,
            soldPrice: parsedSold,
            potentialPrice: parsedPotential,
            holderId,
            notes: notes || undefined,
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

  return (
    <form onSubmit={submit} className="inv-card">
      {isEdit && initial && !initial.variantId && (
        <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: '#374151' }}>
          <span className="inv-badge inv-badge--unlinked">Unlinked custom item</span>
        </p>
      )}

      {!isEdit && (
        <div className="inv-tabs" role="tablist">
          <button
            type="button"
            className={source === 'catalogue' ? 'is-active' : undefined}
            onClick={() => setSource('catalogue')}
          >
            From catalogue
          </button>
          <button
            type="button"
            className={source === 'custom' ? 'is-active' : undefined}
            onClick={() => setSource('custom')}
          >
            Custom item
          </button>
        </div>
      )}

      {showCataloguePicker && (
        <>
          <div className="inv-field">
            <label>Search product / SKU</label>
            {selectedVariant && !cataloguePickerOpen ? (
              <div className="inv-picker-selected">
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{selectedVariant.label}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{selectedVariant.sku}</div>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  style={{ padding: '6px 10px', fontSize: '0.75rem', flexShrink: 0 }}
                  onClick={() => {
                    setCataloguePickerOpen(true)
                    setPickerSearch('')
                    setVariantId('')
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
                  if (variantId) setVariantId('')
                }}
                onFocus={() => setCataloguePickerOpen(true)}
                placeholder="e.g. solitaire, AJLR-598"
                autoComplete="off"
              />
            )}
          </div>
          {cataloguePickerOpen && !selectedVariant && (
            <div className="inv-picker">
              {filteredVariants.length === 0 ? (
                <p style={{ padding: '12px 10px', margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>
                  No products match — try another search.
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
                    <span style={{ color: '#032b24', fontWeight: 500 }}>{v.sku}</span>
                  </button>
                ))
              )}
            </div>
          )}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
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
                  {a.order.contactName} ({a.order.id.slice(-8)})
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p style={{ color: '#b91c1c', fontSize: '0.8125rem', marginTop: 12 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button type="submit" className="admin-btn" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add inventory'}
        </button>
        <button type="button" className="admin-btn admin-btn--secondary" onClick={() => router.back()}>
          Cancel
        </button>
        {isEdit && Number(qtyOnHand) > 0 && (
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
            className="admin-btn admin-btn--danger"
            onClick={remove}
            style={{ marginLeft: 'auto' }}
          >
            Delete
          </button>
        )}
      </div>

      {isEdit && initial && (
        <InventoryMarkSoldDialog
          itemId={initial.id}
          itemLabel={inventoryDisplayName({
            customName: initial.customName,
            product: initial.product,
            variant: initial.variant,
          })}
          qtyOnHand={Number(qtyOnHand)}
          open={markSoldOpen}
          onClose={() => setMarkSoldOpen(false)}
        />
      )}
    </form>
  )
}
