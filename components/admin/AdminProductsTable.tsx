'use client'

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
  variantCount: number
  mediaCount: number
}

const STATUS_META: Record<AdminProductRow['status'], { label: string; className: string }> = {
  LIVE: { label: 'Live', className: 'admin-products__badge is-active' },
  DRAFT: { label: 'Draft', className: 'admin-products__badge' },
  AI_DRAFT: { label: 'AI Draft', className: 'admin-products__badge is-ai' },
}

const ROW_OPTIONS = [10, 25, 50] as const

type Props = {
  products: AdminProductRow[]
  total: number
  page: number
  rows: number
}

function categoryLabel(cat: string) {
  return cat.charAt(0) + cat.slice(1).toLowerCase()
}

export function AdminProductsTable({ products, total, page, rows }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

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
  }

  function goPage(next: number) {
    const clamped = Math.min(Math.max(1, next), totalPages)
    router.push(hrefWith({ page: clamped === 1 ? null : String(clamped) }))
  }

  return (
    <div className="admin-products">
      {/* Mobile cards */}
      <ul className="admin-products__cards">
        {products.map((p) => (
          <li key={p.id} className="admin-products__card">
            <div className="admin-products__card-media">
              {p.images[0] ? (
                <Image src={p.images[0]} alt={p.name} fill style={{ objectFit: 'cover' }} />
              ) : (
                <span className="admin-products__placeholder">V</span>
              )}
            </div>
            <div className="admin-products__card-body">
              <div className="admin-products__card-top">
                <strong className="admin-products__name">{p.name}</strong>
                <span className={STATUS_META[p.status].className}>
                  {STATUS_META[p.status].label}
                </span>
              </div>
              <p className="admin-products__meta">
                {categoryLabel(p.category)}
                {p.itemCode ? ` · ${p.itemCode}` : ''}
              </p>
              <p className="admin-products__meta">
                {p.mediaCount} media · {p.variantCount} variant{p.variantCount === 1 ? '' : 's'}
              </p>
              <Link href={`/admin/products/${p.id}/edit`} className="admin-products__edit">
                Edit →
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="admin-products__table-wrap">
        <table className="admin-products__table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Item Code</th>
              <th>Media</th>
              <th>Variants</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="admin-products__product-cell">
                    <div className="admin-products__thumb">
                      {p.images[0] ? (
                        <Image src={p.images[0]} alt={p.name} fill style={{ objectFit: 'cover' }} />
                      ) : (
                        <span className="admin-products__placeholder">V</span>
                      )}
                    </div>
                    <span className="admin-products__name">{p.name}</span>
                  </div>
                </td>
                <td>{categoryLabel(p.category)}</td>
                <td className="admin-products__code">{p.itemCode ?? '—'}</td>
                <td className={p.mediaCount ? undefined : 'is-warn'}>{p.mediaCount}</td>
                <td>{p.variantCount}</td>
                <td>
                  <span className={STATUS_META[p.status].className}>
                    {STATUS_META[p.status].label}
                  </span>
                </td>
                <td className="admin-products__actions">
                  <Link href={`/admin/products/${p.id}/edit`}>Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination bar: rows + pages side by side, below table only */}
      <nav className="admin-products__pager" aria-label="Product pagination">
        <div className="admin-products__pager-left">
          <label className="admin-products__rows">
            <span>Rows</span>
            <select
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {ROW_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <p className="admin-products__range">
            {total === 0 ? '0 products' : `${from}–${to} of ${total}`}
          </p>
        </div>

        <div className="admin-products__pager-right">
          <button type="button" disabled={page <= 1} onClick={() => goPage(page - 1)}>
            Previous
          </button>
          {totalPages > 1 && (
            <div className="admin-products__pages">
              {pageButtons(page, totalPages).map((item, i) =>
                item === '…' ? (
                  <span key={`e-${i}`} className="admin-products__ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={item === page ? 'is-active' : undefined}
                    onClick={() => goPage(item)}
                    aria-current={item === page ? 'page' : undefined}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>
          )}
          <button type="button" disabled={page >= totalPages} onClick={() => goPage(page + 1)}>
            Next
          </button>
        </div>
      </nav>
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
