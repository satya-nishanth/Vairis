'use client'

import { useMemo, useState } from 'react'

const CATEGORIES = [
  { key: 'ALL', label: 'All' },
  { key: 'RINGS', label: 'Rings' },
  { key: 'EARRINGS', label: 'Earrings' },
  { key: 'PENDANTS', label: 'Pendants' },
  { key: 'BRACELETS', label: 'Bracelets' },
  { key: 'NECKLACES', label: 'Necklaces' },
] as const

export type CatalogueProductOption = {
  id: string
  name: string
  itemCode: string | null
  category: string
  /** Optional SKUs for search (first few variants). */
  skus?: string[]
}

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

/** Order-style catalogue search: category chips + product/SKU/item-code search. Selects one product. */
export function CatalogueProductPicker({
  products,
  value,
  onChange,
  allowClear = true,
}: {
  products: CatalogueProductOption[]
  value: string
  onChange: (productId: string) => void
  allowClear?: boolean
}) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['key']>('ALL')
  const [search, setSearch] = useState('')

  const selected = useMemo(
    () => products.find((p) => p.id === value) ?? null,
    [products, value],
  )

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: products.length }
    for (const c of CATEGORIES) {
      if (c.key === 'ALL') continue
      counts[c.key] = products.filter((p) => p.category === c.key).length
    }
    return counts
  }, [products])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return [] as CatalogueProductOption[]
    return products
      .filter((p) => (category === 'ALL' ? true : p.category === category))
      .filter((p) => {
        if (p.name.toLowerCase().includes(q)) return true
        if (p.itemCode?.toLowerCase().includes(q)) return true
        if (p.skus?.some((s) => s.toLowerCase().includes(q))) return true
        return false
      })
      .slice(0, 40)
  }, [products, category, search])

  return (
    <div>
      {selected && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 8,
            padding: '8px 10px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            fontSize: '0.8125rem',
          }}
        >
          <span>
            <strong>Selected:</strong> {selected.name}
            {selected.itemCode ? ` (${selected.itemCode})` : ''}
          </span>
          {allowClear && (
            <button
              type="button"
              onClick={() => {
                onChange('')
                setSearch('')
              }}
              style={{
                border: 'none',
                background: 'none',
                color: '#b91c1c',
                cursor: 'pointer',
                fontSize: '0.75rem',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      <label style={{ ...label, marginTop: selected ? 4 : 0 }}>Category</label>
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
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="e.g. solitaire, VR-R-012, SKU…"
      />

      {search.trim() !== '' && (
        <div
          style={{
            marginTop: 8,
            border: '1px solid #e5e7eb',
            maxHeight: 260,
            overflowY: 'auto',
            background: '#fafafa',
          }}
        >
          {filtered.length === 0 ? (
            <p style={{ padding: '12px 10px', fontSize: '0.8125rem', color: '#9ca3af', margin: 0 }}>
              No products match — try another category or search.
            </p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id)
                  setSearch('')
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 10px',
                  fontSize: '0.8125rem',
                  background: p.id === value ? '#ecfdf5' : '#fff',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  {p.itemCode ? (
                    <span style={{ color: '#6b7280' }}> · {p.itemCode}</span>
                  ) : null}
                </span>
                <span style={{ color: '#9ca3af', flexShrink: 0, fontSize: '0.75rem' }}>{p.category}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
