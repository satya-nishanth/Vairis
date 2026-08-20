'use client'

import { useMemo, useState } from 'react'
import {
  catalogueVariantFromCreatedProduct,
  lineFromCatalogueVariant,
  type InvoiceCatalogueVariant,
  type InvoiceDiamondRateOption,
  type InvoiceLine,
} from '@/lib/invoice-document'
import type { PricingConfig } from '@/lib/pricing'

const CATEGORIES = [
  { key: 'ALL', label: 'All' },
  { key: 'RINGS', label: 'Rings' },
  { key: 'EARRINGS', label: 'Earrings' },
  { key: 'PENDANTS', label: 'Pendants' },
  { key: 'BRACELETS', label: 'Bracelets' },
  { key: 'NECKLACES', label: 'Necklaces' },
] as const

type Props = {
  variants: InvoiceCatalogueVariant[]
  goldRates: Record<string, number>
  config: PricingConfig
  diamondRates: InvoiceDiamondRateOption[]
  onPick: (line: InvoiceLine, variant: InvoiceCatalogueVariant) => void
  onCreated: (variant: InvoiceCatalogueVariant) => void
}

export function InvoiceProductPicker({
  variants,
  goldRates,
  config,
  diamondRates,
  onPick,
  onCreated,
}: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['key']>('ALL')
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return variants
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
      .slice(0, 40)
  }, [variants, category, query])

  function pick(v: InvoiceCatalogueVariant) {
    onPick(lineFromCatalogueVariant(v, goldRates, config), v)
    setQuery('')
  }

  return (
    <div className="inv-picker">
      <div className="inv-composer__grid">
        <div>
          <label>Search catalogue</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, item code, or SKU"
          />
        </div>
        <div>
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {filtered.length > 0 && (
        <ul className="inv-picker__list">
          {filtered.map((v) => (
            <li key={v.variantId}>
              <button type="button" onClick={() => pick(v)}>
                {v.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 1 && filtered.length === 0 && (
        <p className="inv-picker__empty">No matching products</p>
      )}
      <button type="button" className="admin-btn" onClick={() => setCreating(true)}>
        Create new product
      </button>
      {creating && (
        <InvoiceCreateProductForm
          diamondRates={diamondRates}
          onCancel={() => setCreating(false)}
          onCreated={(variant) => {
            setCreating(false)
            onCreated(variant)
            pick(variant)
          }}
        />
      )}
    </div>
  )
}

function InvoiceCreateProductForm({
  diamondRates,
  onCancel,
  onCreated,
}: {
  diamondRates: InvoiceDiamondRateOption[]
  onCancel: () => void
  onCreated: (variant: InvoiceCatalogueVariant) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('RINGS')
  const [itemCode, setItemCode] = useState('')
  const [metalType, setMetalType] = useState('GOLD_18K')
  const [size, setSize] = useState('')
  const [weightGrams, setWeightGrams] = useState('')
  const [makingChargePerGram, setMakingChargePerGram] = useState('0')
  const [sku, setSku] = useState('')
  const [diamondRateId, setDiamondRateId] = useState(diamondRates[0]?.id ?? '')
  const [caratWeight, setCaratWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Product name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const resolvedSku = sku.trim() || `INV-${Date.now().toString(36).toUpperCase()}`
      const stones =
        diamondRateId && Number(caratWeight) > 0
          ? [{ diamondRateId, caratWeight: Number(caratWeight) }]
          : []
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: '',
          category,
          itemCode: itemCode.trim() || null,
          status: 'DRAFT',
          isActive: true,
          images: [],
          stones,
          variants: [
            {
              metalType,
              size: size.trim() || undefined,
              weightGrams: Number(weightGrams) || 0,
              makingChargePerGram: Number(makingChargePerGram) || 0,
              sku: resolvedSku,
            },
          ],
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Could not create product')
        return
      }
      const variant = catalogueVariantFromCreatedProduct(json)
      if (!variant) {
        setError('Product saved but has no variant')
        return
      }
      onCreated(variant)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="inv-create-product" onSubmit={submit}>
      <p style={{ margin: '12px 0 8px', fontSize: '0.8rem', fontWeight: 600 }}>New catalogue product</p>
      <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: '#6b7280' }}>
        Saved as a draft product. HUID and certificates are filled on the invoice line, not here.
      </p>
      {error && <p style={{ color: '#b91c1c', fontSize: '0.8rem' }}>{error}</p>}
      <div className="inv-composer__grid">
        <div>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.filter((c) => c.key !== 'ALL').map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Item code</label>
          <input value={itemCode} onChange={(e) => setItemCode(e.target.value)} />
        </div>
        <div>
          <label>SKU</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Auto if empty" />
        </div>
        <div>
          <label>Metal</label>
          <select value={metalType} onChange={(e) => setMetalType(e.target.value)}>
            <option value="GOLD_18K">18K Yellow Gold</option>
            <option value="GOLD_14K">14K Yellow Gold</option>
            <option value="ROSE_GOLD">18K Rose Gold</option>
          </select>
        </div>
        <div>
          <label>Size</label>
          <input value={size} onChange={(e) => setSize(e.target.value)} />
        </div>
        <div>
          <label>Gold weight (g)</label>
          <input type="number" step="0.001" value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} />
        </div>
        <div>
          <label>Making ₹/g</label>
          <input
            type="number"
            step="0.01"
            value={makingChargePerGram}
            onChange={(e) => setMakingChargePerGram(e.target.value)}
          />
        </div>
        {diamondRates.length > 0 && (
          <>
            <div>
              <label>Diamond type (optional)</label>
              <select value={diamondRateId} onChange={(e) => setDiamondRateId(e.target.value)}>
                <option value="">None</option>
                {diamondRates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Carat (optional)</label>
              <input type="number" step="0.001" value={caratWeight} onChange={(e) => setCaratWeight(e.target.value)} />
            </div>
          </>
        )}
      </div>
      <div className="inv-composer__actions" style={{ marginTop: 8 }}>
        <button type="submit" className="admin-btn" disabled={saving}>
          {saving ? 'Saving…' : 'Save product and add line'}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
