'use client'

import { useMemo, useState } from 'react'
import {
  lineFromCatalogueVariant,
  type InvoiceCatalogueVariant,
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
  onPick: (line: InvoiceLine, variant: InvoiceCatalogueVariant) => void
  onCreateNew: () => void
}

export function InvoiceProductPicker({ variants, goldRates, config, onPick, onCreateNew }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['key']>('ALL')

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
      <button type="button" className="admin-btn" onClick={onCreateNew}>
        Create new product
      </button>
    </div>
  )
}
