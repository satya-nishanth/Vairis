'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export type AdminProductRow = {
  id: string
  name: string
  category: string
  itemCode: string | null
  images: string[]
  isActive: boolean
  status: 'DRAFT' | 'AI_DRAFT' | 'LIVE'
  priority?: number
  variantCount: number
  mediaCount: number
  description?: string
  designStyle?: string | null
  stoneType?: string | null
  stoneShape?: string | null
  caratWeight?: number | null
  gemCount?: number | null
  stoneDimMm?: string | null
  totalLengthMm?: number | null
  motifSizeMm?: number | null
  thicknessMm?: number | null
  metals?: string[]
  variantsList?: {
    metalType: string
    sku: string
    size: string | null
    weightGrams: number
    stock: number
  }[]
  stonesList?: {
    label: string
    caratWeight: number
    count: number | null
  }[]
}

const STATUS_META: Record<AdminProductRow['status'], { label: string; className: string; bg: string; color: string; border: string }> = {
  LIVE: { label: 'Live', className: 'admin-products__badge is-active', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  DRAFT: { label: 'Draft', className: 'admin-products__badge', bg: '#f3f4f6', color: '#4b5563', border: '#e5e7eb' },
  AI_DRAFT: { label: 'AI Draft', className: 'admin-products__badge is-ai', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
}

const ROW_OPTIONS = [10, 25, 50, 100, 500] as const

type Props = {
  products: AdminProductRow[]
  total: number
  page: number
  rows: number
}

function categoryLabel(cat: string) {
  return cat.charAt(0) + cat.slice(1).toLowerCase().replace(/_/g, ' ')
}

function formatMetal(m: string) {
  switch (m) {
    case 'GOLD_18K':
      return '18K Gold'
    case 'GOLD_14K':
      return '14K Gold'
    case 'ROSE_GOLD':
      return 'Rose Gold'
    default:
      return m
  }
}

export function AdminProductsTable({ products: initialProducts, total, page, rows }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<AdminProductRow[]>(initialProducts)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [inspectProduct, setInspectProduct] = useState<AdminProductRow | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Sync state whenever server initialProducts changes (rows change, pagination, filters)
  useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])

  const totalPages = Math.max(1, Math.ceil(total / rows))
  const from = total === 0 ? 0 : (page - 1) * rows + 1
  const to = Math.min(page * rows, total)

  function hrefWith(updates: Record<string, string | null>) {
    const q = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') q.delete(k)
      else q.set(k, v)
    }
    const s = q.toString()
    return s ? `${pathname}?${s}` : pathname
  }

  function setRows(next: number) {
    router.push(hrefWith({ rows: String(next), page: '1' }))
    router.refresh()
  }

  function goPage(next: number) {
    const clamped = Math.min(Math.max(1, next), totalPages)
    router.push(hrefWith({ page: clamped === 1 ? null : String(clamped) }))
    router.refresh()
  }

  function openInspect(p: AdminProductRow, initialIdx = 0) {
    setInspectProduct(p)
    setLightboxIndex(initialIdx)
  }

  async function handleQuickStatus(productId: string, nextStatus: AdminProductRow['status']) {
    setUpdatingId(productId)
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, status: nextStatus } : p)),
    )
    if (inspectProduct && inspectProduct.id === productId) {
      setInspectProduct({ ...inspectProduct, status: nextStatus })
    }

    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) {
        // Revert
        setProducts(initialProducts)
        alert('Failed to update product status')
      }
    } catch {
      setProducts(initialProducts)
      alert('Network error updating status')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="admin-products" style={{ marginTop: '1.25rem' }}>
      {/* Top View Toggle Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>
            {total} product{total === 1 ? '' : 's'} found
          </span>
        </div>

        {/* View Switcher: Grid vs Table */}
        <div
          style={{
            display: 'inline-flex',
            background: '#f3f4f6',
            borderRadius: 8,
            padding: 3,
            border: '1px solid #e5e7eb',
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              borderRadius: 6,
              border: 'none',
              background: viewMode === 'grid' ? '#fff' : 'transparent',
              color: viewMode === 'grid' ? '#111827' : '#6b7280',
              boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            Visual Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              borderRadius: 6,
              border: 'none',
              background: viewMode === 'table' ? '#fff' : 'transparent',
              color: viewMode === 'table' ? '#111827' : '#6b7280',
              boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Detailed Table
          </button>
        </div>
      </div>

      {/* 1. VISUAL GRID VIEW */}
      {viewMode === 'grid' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: 20,
            marginBottom: '1.5rem',
          }}
        >
          {products.map((p) => (
            <ProductCardItem
              key={p.id}
              product={p}
              onInspect={(idx) => openInspect(p, idx)}
              onStatusChange={(status) => handleQuickStatus(p.id, status)}
              isUpdating={updatingId === p.id}
            />
          ))}
          {products.length === 0 && (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '4rem 2rem',
                textAlign: 'center',
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                color: '#6b7280',
              }}
            >
              <p style={{ fontSize: '1.125rem', fontWeight: 500, color: '#111827', margin: 0 }}>No products found</p>
              <p style={{ fontSize: '0.875rem', marginTop: 4 }}>Try clearing the search filter or choose another category.</p>
            </div>
          )}
        </div>
      )}

      {/* 2. DETAILED TABLE VIEW (WITH ENLARGED 84px THUMBNAILS & DETAILS) */}
      {viewMode === 'table' && (
        <div
          className="admin-products__table-wrap"
          style={{
            display: 'block',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Product Visual & Info</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Priority</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Category</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Item Code</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Specifications</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Media</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const meta = STATUS_META[p.status]
                const primaryImage = p.images[0]
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    {/* Visual Product Cell */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div
                          onClick={() => openInspect(p, 0)}
                          title="Click to zoom & inspect full photos"
                          style={{
                            position: 'relative',
                            width: 84,
                            height: 84,
                            borderRadius: 8,
                            background: '#f8f9fa',
                            border: '1px solid #e5e7eb',
                            overflow: 'hidden',
                            flexShrink: 0,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {primaryImage ? (
                            <Image
                              src={primaryImage}
                              alt={p.name}
                              fill
                              sizes="84px"
                              style={{ objectFit: 'contain', padding: 4 }}
                            />
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: '1rem', fontWeight: 600 }}>VAIRIS</span>
                          )}
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 3,
                              right: 3,
                              background: 'rgba(0,0,0,0.65)',
                              color: '#fff',
                              borderRadius: 4,
                              padding: '1px 4px',
                              fontSize: '0.625rem',
                              fontWeight: 500,
                            }}
                          >
                            🔍 {p.mediaCount}
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <Link
                            href={`/admin/products/${p.id}/edit`}
                            style={{
                              fontWeight: 600,
                              color: '#111827',
                              textDecoration: 'none',
                              fontSize: '0.9375rem',
                              display: 'block',
                            }}
                          >
                            {p.name}
                          </Link>
                          {p.itemCode && (
                            <span
                              style={{
                                fontFamily: 'ui-monospace, monospace',
                                fontSize: '0.75rem',
                                color: '#6b7280',
                                background: '#f3f4f6',
                                padding: '1px 6px',
                                borderRadius: 4,
                                display: 'inline-block',
                                marginTop: 4,
                              }}
                            >
                              {p.itemCode}
                            </span>
                          )}
                          {p.metals && p.metals.length > 0 && (
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>
                              {p.metals.map(formatMetal).join(' · ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Priority */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#f3f4f6',
                          color: '#111827',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          fontFamily: 'ui-monospace, monospace',
                        }}
                        title="Display Priority (0 is first)"
                      >
                        {p.priority ?? 0}
                      </span>
                    </td>

                    {/* Category */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 14,
                          background: '#fdf8f0',
                          border: '1px solid #faeed5',
                          color: '#b78a3c',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {categoryLabel(p.category)}
                      </span>
                    </td>

                    {/* Item Code */}
                    <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', color: '#4b5563' }}>
                      {p.itemCode ?? '—'}
                    </td>

                    {/* Specifications */}
                    <td style={{ padding: '12px 16px', fontSize: '0.8125rem' }}>
                      {p.stoneType || p.caratWeight ? (
                        <div style={{ color: '#374151' }}>
                          <div style={{ fontWeight: 500 }}>
                            {p.stoneType ?? 'Diamond'} {p.stoneShape ? `· ${p.stoneShape}` : ''}
                          </div>
                          {p.caratWeight && (
                            <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                              {p.caratWeight} ct {p.gemCount ? `(${p.gemCount} stones)` : ''}
                            </div>
                          )}
                        </div>
                      ) : p.designStyle ? (
                        <span style={{ color: '#6b7280' }}>{p.designStyle}</span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Standard</span>
                      )}
                    </td>

                    {/* Media Count & Angle Preview */}
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        type="button"
                        onClick={() => openInspect(p, 0)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          color: '#4b5563',
                          cursor: 'pointer',
                        }}
                      >
                        📷 {p.mediaCount} angle{p.mediaCount === 1 ? '' : 's'}
                      </button>
                    </td>

                    {/* Status Badge with Quick Toggle */}
                    <td style={{ padding: '12px 16px' }}>
                      <select
                        value={p.status}
                        onChange={(e) => handleQuickStatus(p.id, e.target.value as AdminProductRow['status'])}
                        style={{
                          background: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`,
                          borderRadius: 14,
                          padding: '3px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <option value="LIVE">Live</option>
                        <option value="DRAFT">Draft</option>
                        <option value="AI_DRAFT">AI Draft</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => openInspect(p, 0)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            fontSize: '0.75rem',
                            color: '#374151',
                            cursor: 'pointer',
                          }}
                          title="Quick View & Inspect"
                        >
                          Inspect 🔍
                        </button>
                        <Link
                          href={`/admin/products/${p.id}/edit`}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 6,
                            background: '#111827',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            textDecoration: 'none',
                            display: 'inline-block',
                          }}
                        >
                          Edit
                        </Link>
                        {p.status === 'LIVE' && (
                          <a
                            href={`/product/${p.id}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              padding: '5px 8px',
                              fontSize: '0.75rem',
                              color: '#b78a3c',
                              textDecoration: 'none',
                            }}
                            title="View product on live storefront"
                          >
                            ↗
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination bar */}
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1rem 0',
        }}
        aria-label="Product pagination"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#6b7280' }}>
            <span>Rows per page:</span>
            <select
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#fff',
                fontSize: '0.8125rem',
              }}
              aria-label="Rows per page"
            >
              {ROW_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n === 500 ? 'All (500)' : n}
                </option>
              ))}
            </select>
          </label>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
            {total === 0 ? '0 products' : `${from}–${to} of ${total}`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goPage(page - 1)}
            style={{
              padding: '6px 12px',
              fontSize: '0.8125rem',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#fff',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              opacity: page <= 1 ? 0.5 : 1,
            }}
          >
            Previous
          </button>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {pageButtons(page, totalPages).map((item, i) =>
                item === '…' ? (
                  <span key={`e-${i}`} style={{ padding: '6px 8px', color: '#9ca3af' }}>
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => goPage(item)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.8125rem',
                      borderRadius: 6,
                      border: '1px solid',
                      borderColor: item === page ? '#111827' : '#d1d5db',
                      background: item === page ? '#111827' : '#fff',
                      color: item === page ? '#fff' : '#374151',
                      cursor: 'pointer',
                      fontWeight: item === page ? 600 : 400,
                    }}
                    aria-current={item === page ? 'page' : undefined}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>
          )}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => goPage(page + 1)}
            style={{
              padding: '6px 12px',
              fontSize: '0.8125rem',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#fff',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages ? 0.5 : 1,
            }}
          >
            Next
          </button>
        </div>
      </nav>

      {/* 3. FULL-RESOLUTION QUICK INSPECT LIGHTBOX MODAL */}
      {inspectProduct && (
        <ProductInspectModal
          product={inspectProduct}
          initialIndex={lightboxIndex}
          onClose={() => setInspectProduct(null)}
          onStatusChange={(status) => handleQuickStatus(inspectProduct.id, status)}
        />
      )}
    </div>
  )
}

/** Individual visual card for Grid View */
function ProductCardItem({
  product: p,
  onInspect,
  onStatusChange,
  isUpdating,
}: {
  product: AdminProductRow
  onInspect: (initialIdx: number) => void
  onStatusChange: (status: AdminProductRow['status']) => void
  isUpdating: boolean
}) {
  const [activeIdx, setActiveIdx] = useState(0)
  const meta = STATUS_META[p.status]
  const currentImage = p.images[activeIdx] || p.images[0]

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Visual Image Header */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 240,
          background: '#f8f9fa',
          borderBottom: '1px solid #f0f0ee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
        onClick={() => onInspect(activeIdx)}
      >
        {currentImage ? (
          <Image
            src={currentImage}
            alt={p.name}
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            style={{ objectFit: 'contain', padding: 12 }}
          />
        ) : (
          <div style={{ color: '#9ca3af', fontSize: '1.25rem', fontWeight: 600 }}>VAIRIS</div>
        )}

        {/* Top Badges */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            right: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              padding: '3px 8px',
              borderRadius: 12,
              background: meta.bg,
              color: meta.color,
              border: `1px solid ${meta.border}`,
              fontSize: '0.6875rem',
              fontWeight: 600,
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            }}
          >
            {meta.label}
          </span>
          {p.itemCode && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.92)',
                color: '#374151',
                fontSize: '0.6875rem',
                fontFamily: 'ui-monospace, monospace',
                fontWeight: 600,
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              }}
            >
              {p.itemCode}
            </span>
          )}
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.92)',
              color: '#111827',
              fontSize: '0.6875rem',
              fontWeight: 600,
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            }}
            title="Display Priority (0 is listed first)"
          >
            Pri: {p.priority ?? 0}
          </span>
        </div>

        {/* Zoom Hint Icon */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            background: 'rgba(17, 24, 39, 0.75)',
            color: '#fff',
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: '0.6875rem',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          🔍 Inspect
        </div>
      </div>

      {/* Interactive Angle Switcher (if >1 image) */}
      {p.images.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '8px 12px',
            background: '#fafafa',
            borderBottom: '1px solid #f3f4f6',
            overflowX: 'auto',
          }}
        >
          {p.images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setActiveIdx(i)
              }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                position: 'relative',
                width: 36,
                height: 36,
                borderRadius: 4,
                border: i === activeIdx ? '2px solid #b78a3c' : '1px solid #e5e7eb',
                background: '#fff',
                overflow: 'hidden',
                padding: 0,
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title={`View Angle ${i + 1}`}
            >
              <Image src={img} alt="" fill sizes="36px" style={{ objectFit: 'contain', padding: 2 }} />
            </button>
          ))}
        </div>
      )}

      {/* Card Body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: '#b78a3c',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {categoryLabel(p.category)}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            {p.variantCount} variant{p.variantCount === 1 ? '' : 's'}
          </span>
        </div>

        <Link
          href={`/admin/products/${p.id}/edit`}
          style={{
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: '#111827',
            textDecoration: 'none',
            lineHeight: 1.35,
            marginBottom: 8,
          }}
        >
          {p.name}
        </Link>

        {/* Specifications snippet */}
        <div style={{ fontSize: '0.75rem', color: '#4b5563', marginBottom: 12, flex: 1 }}>
          {p.stoneType || p.caratWeight ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#b78a3c' }}>✦</span>
              <span>
                {p.caratWeight ? `${p.caratWeight} ct ` : ''}
                {p.stoneType ?? 'Diamond'} {p.stoneShape ? `· ${p.stoneShape}` : ''}
              </span>
            </div>
          ) : (
            <div style={{ color: '#9ca3af' }}>{p.designStyle || 'Handcrafted fine jewellery'}</div>
          )}
          {p.metals && p.metals.length > 0 && (
            <div style={{ color: '#9ca3af', marginTop: 4 }}>
              {p.metals.map(formatMetal).join(' · ')}
            </div>
          )}
        </div>

        {/* Card Actions Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #f3f4f6',
            paddingTop: 10,
            marginTop: 'auto',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link
              href={`/admin/products/${p.id}/edit`}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                background: '#111827',
                color: '#fff',
                fontSize: '0.8125rem',
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Edit
            </Link>
            {p.status === 'LIVE' && (
              <a
                href={`/product/${p.id}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '0.75rem',
                  color: '#b78a3c',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                Storefront ↗
              </a>
            )}
          </div>

          {/* Quick Status Select */}
          <select
            value={p.status}
            disabled={isUpdating}
            onChange={(e) => onStatusChange(e.target.value as AdminProductRow['status'])}
            style={{
              background: meta.bg,
              color: meta.color,
              border: `1px solid ${meta.border}`,
              borderRadius: 12,
              padding: '2px 8px',
              fontSize: '0.6875rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="LIVE">Live</option>
            <option value="DRAFT">Draft</option>
            <option value="AI_DRAFT">AI Draft</option>
          </select>
        </div>
      </div>
    </div>
  )
}

/** Full-Screen High-Resolution Lightbox Modal */
function ProductInspectModal({
  product: p,
  initialIndex,
  onClose,
  onStatusChange,
}: {
  product: AdminProductRow
  initialIndex: number
  onClose: () => void
  onStatusChange: (status: AdminProductRow['status']) => void
}) {
  const [currentIdx, setCurrentIdx] = useState(initialIndex)
  const meta = STATUS_META[p.status]
  const images = p.images.length > 0 ? p.images : []
  const activeImage = images[currentIdx]

  function nextImage() {
    if (images.length <= 1) return
    setCurrentIdx((prev) => (prev + 1) % images.length)
  }

  function prevImage() {
    if (images.length <= 1) return
    setCurrentIdx((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="admin-product-inspect-card"
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 980,
          maxHeight: '90vh',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: High-Res Visual Carousel */}
        <div
          style={{
            background: '#f8f9fa',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid #e5e7eb',
            position: 'relative',
          }}
        >
          {/* Main Photo Area */}
          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 440,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {activeImage ? (
              <Image
                src={activeImage}
                alt={p.name}
                fill
                sizes="550px"
                style={{ objectFit: 'contain', padding: 24 }}
                priority
              />
            ) : (
              <div style={{ color: '#9ca3af', fontSize: '1.5rem', fontWeight: 600 }}>VAIRIS</div>
            )}

            {/* Prev / Next Controls */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevImage}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.9)',
                    border: '1px solid #e5e7eb',
                    fontSize: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={nextImage}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.9)',
                    border: '1px solid #e5e7eb',
                    fontSize: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  }}
                >
                  ›
                </button>
              </>
            )}

            {/* Photo Counter Pill */}
            {images.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  background: 'rgba(17, 24, 39, 0.75)',
                  color: '#fff',
                  borderRadius: 12,
                  padding: '3px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              >
                Photo {currentIdx + 1} of {images.length}
              </div>
            )}
          </div>

          {/* Bottom Thumbnail Strip */}
          {images.length > 1 && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: '12px 16px',
                background: '#fff',
                borderTop: '1px solid #e5e7eb',
                overflowX: 'auto',
              }}
            >
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIdx(idx)}
                  style={{
                    position: 'relative',
                    width: 52,
                    height: 52,
                    borderRadius: 6,
                    border: idx === currentIdx ? '2px solid #b78a3c' : '1px solid #e5e7eb',
                    background: '#f8f9fa',
                    padding: 0,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <Image src={img} alt="" fill sizes="52px" style={{ objectFit: 'contain', padding: 2 }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Technical & Merchandising Specs */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Header & Close */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#b78a3c',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {categoryLabel(p.category)}
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', margin: '4px 0 0 0' }}>
                {p.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: 'pointer',
                fontSize: '1rem',
                color: '#4b5563',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {/* Quick Badges */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 12,
                background: meta.bg,
                color: meta.color,
                border: `1px solid ${meta.border}`,
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {meta.label}
            </span>
            {p.itemCode && (
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: '#f3f4f6',
                  color: '#374151',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                SKU: {p.itemCode}
              </span>
            )}
          </div>

          {/* Description snippet */}
          {p.description && (
            <p style={{ fontSize: '0.8125rem', color: '#4b5563', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              {p.description}
            </p>
          )}

          {/* Specifications Table */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ background: '#f9fafb', padding: '8px 12px', fontWeight: 600, fontSize: '0.75rem', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
              Product Details & Attributes
            </div>
            <div style={{ padding: '8px 12px', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {p.stoneType && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Stone Type:</span>
                  <span style={{ fontWeight: 500, color: '#111827' }}>{p.stoneType}</span>
                </div>
              )}
              {p.stoneShape && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Stone Shape:</span>
                  <span style={{ fontWeight: 500, color: '#111827' }}>{p.stoneShape}</span>
                </div>
              )}
              {p.caratWeight && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Total Carat:</span>
                  <span style={{ fontWeight: 500, color: '#111827' }}>{p.caratWeight} ct</span>
                </div>
              )}
              {p.gemCount && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Gem Count:</span>
                  <span style={{ fontWeight: 500, color: '#111827' }}>{p.gemCount} pcs</span>
                </div>
              )}
              {p.designStyle && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Design Style:</span>
                  <span style={{ fontWeight: 500, color: '#111827' }}>{p.designStyle}</span>
                </div>
              )}
              {p.metals && p.metals.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Metals:</span>
                  <span style={{ fontWeight: 500, color: '#111827' }}>{p.metals.map(formatMetal).join(', ')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e5e7eb', paddingTop: 4 }}>
                <span style={{ color: '#6b7280' }}>Display Priority:</span>
                <span style={{ fontWeight: 600, color: '#111827' }}>{p.priority ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Variants list if available */}
          {p.variantsList && p.variantsList.length > 0 && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ background: '#f9fafb', padding: '8px 12px', fontWeight: 600, fontSize: '0.75rem', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                Variants ({p.variantsList.length})
              </div>
              <div style={{ padding: '8px 12px', fontSize: '0.75rem' }}>
                {p.variantsList.map((v, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ color: '#374151', fontWeight: 500 }}>{formatMetal(v.metalType)} {v.size ? `· ${v.size}` : ''}</span>
                    <span style={{ color: '#6b7280' }}>{v.weightGrams}g · SKU: {v.sku}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decision Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <Link
              href={`/admin/products/${p.id}/edit`}
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '10px 16px',
                borderRadius: 8,
                background: '#111827',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Open in Full Product Editor →
            </Link>

            <div style={{ display: 'flex', gap: 10 }}>
              {p.status === 'LIVE' ? (
                <a
                  href={`/product/${p.id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #b78a3c',
                    color: '#b78a3c',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  View Live on Storefront ↗
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => onStatusChange('LIVE')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #047857',
                    background: '#ecfdf5',
                    color: '#047857',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Publish to Live Store
                </button>
              )}

              {p.status === 'LIVE' && (
                <button
                  type="button"
                  onClick={() => onStatusChange('DRAFT')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    color: '#6b7280',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Unpublish to Draft
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function pageButtons(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set<number>([1, total, current, current - 1, current + 1])
  if (current <= 3) {
    pages.add(2)
    pages.add(3)
    pages.add(4)
  }
  if (current >= total - 2) {
    pages.add(total - 1)
    pages.add(total - 2)
    pages.add(total - 3)
  }
  const sorted = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push('…')
    out.push(n)
    prev = n
  }
  return out
}
