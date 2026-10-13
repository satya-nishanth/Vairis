'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { CATEGORY_OPTIONS, type ScopeOption } from '@/lib/discount-scope'
import type { Category } from '@prisma/client'

export type ScopeFormValue = {
  productIds: string[]
  collectionIds: string[]
  storeCategoryIds: string[]
  categories: Category[]
}

type Props = {
  value: ScopeFormValue
  onChange: (next: ScopeFormValue) => void
  products: ScopeOption[]
  collections: ScopeOption[]
  storeCategories: ScopeOption[]
}

const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 8px',
  background: '#f3f4f6',
  borderRadius: 12,
  fontSize: '0.75rem',
}

export function DiscountScopeFields({
  value,
  onChange,
  products,
  collections,
  storeCategories,
}: Props) {
  const [productSearch, setProductSearch] = useState('')
  const input = {
    padding: '8px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: '0.8125rem',
    width: '100%',
  } as const

  const unassignedProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    return products
      .filter((p) => !value.productIds.includes(p.id))
      .filter((p) => !q || p.label.toLowerCase().includes(q))
      .slice(0, 20)
  }, [products, value.productIds, productSearch])

  const empty =
    value.productIds.length === 0 &&
    value.collectionIds.length === 0 &&
    value.storeCategoryIds.length === 0 &&
    value.categories.length === 0

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        display: 'grid',
        gap: 12,
        padding: 12,
        background: '#fafafa',
        border: '1px solid #f3f4f6',
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
        Scope — leave empty to apply to <strong>all products</strong>.
        {empty && <span style={{ color: '#059669' }}> (all products)</span>}
      </div>

      <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
        Catalogue categories
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORY_OPTIONS.map((c) => {
            const on = value.categories.includes(c.value)
            return (
              <label key={c.value} style={{ fontSize: '0.75rem', display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    onChange({
                      ...value,
                      categories: on
                        ? value.categories.filter((x) => x !== c.value)
                        : [...value.categories, c.value],
                    })
                  }
                />
                {c.label}
              </label>
            )
          })}
        </div>
      </label>

      <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
        Collections
        <select
          style={input}
          value=""
          onChange={(e) => {
            const id = e.target.value
            if (!id || value.collectionIds.includes(id)) return
            onChange({ ...value, collectionIds: [...value.collectionIds, id] })
          }}
        >
          <option value="">Add collection…</option>
          {collections
            .filter((c) => !value.collectionIds.includes(c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
        </select>
        {value.collectionIds.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {value.collectionIds.map((id) => (
              <span key={id} style={chip}>
                {collections.find((c) => c.id === id)?.label ?? id}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      collectionIds: value.collectionIds.filter((x) => x !== id),
                    })
                  }
                  style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </label>

      <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
        Store categories
        <select
          style={input}
          value=""
          onChange={(e) => {
            const id = e.target.value
            if (!id || value.storeCategoryIds.includes(id)) return
            onChange({ ...value, storeCategoryIds: [...value.storeCategoryIds, id] })
          }}
        >
          <option value="">Add store category…</option>
          {storeCategories
            .filter((c) => !value.storeCategoryIds.includes(c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
        </select>
        {value.storeCategoryIds.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {value.storeCategoryIds.map((id) => (
              <span key={id} style={chip}>
                {storeCategories.find((c) => c.id === id)?.label ?? id}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      storeCategoryIds: value.storeCategoryIds.filter((x) => x !== id),
                    })
                  }
                  style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </label>

      <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
        Products ({value.productIds.length})
        <input
          style={input}
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          placeholder="Search products to add…"
        />
        {value.productIds.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 80, overflowY: 'auto' }}>
            {value.productIds.map((id) => (
              <span key={id} style={chip}>
                {products.find((p) => p.id === id)?.label ?? id}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      productIds: value.productIds.filter((x) => x !== id),
                    })
                  }
                  style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {(productSearch.trim() || unassignedProducts.length < products.length) && productSearch.trim() && (
          <div
            style={{
              maxHeight: 140,
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              background: '#fff',
            }}
          >
            {unassignedProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange({ ...value, productIds: [...value.productIds, p.id] })
                  setProductSearch('')
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 10px',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                }}
              >
                {p.label}
              </button>
            ))}
            {unassignedProducts.length === 0 && (
              <div style={{ padding: 8, fontSize: '0.75rem', color: '#9ca3af' }}>No matches</div>
            )}
          </div>
        )}
      </label>
    </div>
  )
}

export const EMPTY_SCOPE: ScopeFormValue = {
  productIds: [],
  collectionIds: [],
  storeCategoryIds: [],
  categories: [],
}
