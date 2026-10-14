'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import type { Category } from '@prisma/client'
import { CATEGORY_OPTIONS, type ScopeOption } from '@/lib/discount-scope'
import { EMPTY_SCOPE, type ScopeFormValue } from '@/components/admin/DiscountScopeFields'
import { promoKindListLabel } from '@/lib/promo-labels'
import type { PromoKind } from '@prisma/client'

type PromoRow = {
  id: string
  code: string
  description: string
  kind: PromoKind
  value: number
  minOrderValue: number
  maxDiscount: number | null
  startsAt: string | null
  endsAt: string | null
  maxRedemptions: number | null
  maxPerUser: number
  firstOrderOnly: boolean
  active: boolean
  redemptionCount: number
  productIds: string[]
  collectionIds: string[]
  storeCategoryIds: string[]
  categories: Category[]
}

type Props = {
  initial: PromoRow[]
  products: ScopeOption[]
  collections: ScopeOption[]
  storeCategories: ScopeOption[]
}

const EMPTY = {
  code: '',
  description: '',
  kind: 'PERCENT' as PromoKind,
  value: '',
  minOrderValue: '0',
  maxDiscount: '',
  maxRedemptions: '',
  maxPerUser: '1',
  firstOrderOnly: false,
  startsAt: '',
  endsAt: '',
  scopeMode: 'everyone' as 'everyone' | 'specific',
  scope: EMPTY_SCOPE as ScopeFormValue,
  scopeSearch: '',
}

const olive = '#5e684e'
const border = '#e8e8e6'
const muted = '#6b7280'

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(local: string): string | null {
  if (!local.trim()) return null
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function isScopeEmpty(s: ScopeFormValue) {
  return (
    s.productIds.length === 0 &&
    s.collectionIds.length === 0 &&
    s.storeCategoryIds.length === 0 &&
    s.categories.length === 0
  )
}

function scopeLabel(row: PromoRow) {
  if (isScopeEmpty({
    productIds: row.productIds,
    collectionIds: row.collectionIds,
    storeCategoryIds: row.storeCategoryIds,
    categories: row.categories,
  })) {
    return 'Everyone'
  }
  const bits = [
    row.categories.length ? `${row.categories.length} categories` : null,
    row.collectionIds.length ? `${row.collectionIds.length} collections` : null,
    row.storeCategoryIds.length ? `${row.storeCategoryIds.length} store cats` : null,
    row.productIds.length ? `${row.productIds.length} products` : null,
  ].filter(Boolean)
  return bits.join(' · ')
}

function scheduleLabel(row: PromoRow) {
  if (!row.startsAt && !row.endsAt) return 'Always on'
  const fmt = (iso: string | null) => {
    if (!iso) return '…'
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  return `${fmt(row.startsAt)} → ${fmt(row.endsAt)}`
}

function rowToForm(row: PromoRow): typeof EMPTY {
  const scoped = !isScopeEmpty({
    productIds: row.productIds,
    collectionIds: row.collectionIds,
    storeCategoryIds: row.storeCategoryIds,
    categories: row.categories,
  })
  return {
    code: row.code,
    description: row.description,
    kind: row.kind,
    value: row.kind === 'FREE_DELIVERY' ? '' : String(row.value),
    minOrderValue: String(row.minOrderValue),
    maxDiscount: row.maxDiscount != null ? String(row.maxDiscount) : '',
    maxRedemptions: row.maxRedemptions != null ? String(row.maxRedemptions) : '',
    maxPerUser: String(row.maxPerUser),
    firstOrderOnly: row.firstOrderOnly,
    startsAt: toLocalInput(row.startsAt),
    endsAt: toLocalInput(row.endsAt),
    scopeMode: scoped ? 'specific' : 'everyone',
    scope: {
      productIds: [...row.productIds],
      collectionIds: [...row.collectionIds],
      storeCategoryIds: [...row.storeCategoryIds],
      categories: [...row.categories],
    },
    scopeSearch: '',
  }
}

export function PromosManager({ initial, products, collections, storeCategories }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const editingRow = editingId ? initial.find((p) => p.id === editingId) : null
  const codeLocked = Boolean(editingRow && editingRow.redemptionCount > 0)

  const searchHits = useMemo(() => {
    const q = form.scopeSearch.trim().toLowerCase()
    if (!q || form.scopeMode !== 'specific') {
      return { products: [] as ScopeOption[], collections: [] as ScopeOption[], storeCategories: [] as ScopeOption[] }
    }
    return {
      products: products
        .filter((p) => !form.scope.productIds.includes(p.id) && p.label.toLowerCase().includes(q))
        .slice(0, 8),
      collections: collections
        .filter((c) => !form.scope.collectionIds.includes(c.id) && c.label.toLowerCase().includes(q))
        .slice(0, 5),
      storeCategories: storeCategories
        .filter((c) => !form.scope.storeCategoryIds.includes(c.id) && c.label.toLowerCase().includes(q))
        .slice(0, 5),
    }
  }, [form.scopeSearch, form.scopeMode, form.scope, products, collections, storeCategories])

  function closeForm() {
    setOpen(false)
    setEditingId(null)
    setForm(EMPTY)
    setError('')
  }

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY)
    setError('')
    setOpen(true)
  }

  function openEdit(row: PromoRow) {
    setEditingId(row.id)
    setForm(rowToForm(row))
    setError('')
    setOpen(true)
  }

  async function savePromo(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const scope = form.scopeMode === 'everyone' ? EMPTY_SCOPE : form.scope
    if (form.scopeMode === 'specific' && isScopeEmpty(scope)) {
      setBusy(false)
      setError('Add at least one category, collection, or product — or choose Everyone.')
      return
    }
    const body = {
      code: form.code,
      description: form.description || undefined,
      kind: form.kind,
      value: form.kind === 'FREE_DELIVERY' ? 0 : form.value,
      minOrderValue: form.minOrderValue || 0,
      maxDiscount: form.maxDiscount || null,
      maxRedemptions: form.maxRedemptions || null,
      maxPerUser: form.maxPerUser || 1,
      firstOrderOnly: form.firstOrderOnly,
      startsAt: fromLocalInput(form.startsAt),
      endsAt: fromLocalInput(form.endsAt),
      ...scope,
      ...(editingId ? {} : { active: true }),
    }
    const res = await fetch(editingId ? `/api/admin/promos/${editingId}` : '/api/admin/promos', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? (editingId ? 'Update failed' : 'Create failed'))
      return
    }
    closeForm()
    router.refresh()
  }

  async function toggleActive(p: PromoRow) {
    await fetch(`/api/admin/promos/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !p.active }),
    })
    router.refresh()
  }

  async function remove(p: PromoRow) {
    const label = p.redemptionCount > 0 ? `Retire “${p.code}”? (has redemptions)` : `Delete “${p.code}”?`
    if (!window.confirm(label)) return
    await fetch(`/api/admin/promos/${p.id}`, { method: 'DELETE' })
    router.refresh()
  }

  const field: CSSProperties = {
    display: 'grid',
    gap: 6,
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: '#111827',
  }
  const control: CSSProperties = {
    padding: '10px 12px',
    border: `1px solid ${border}`,
    borderRadius: 8,
    fontSize: '0.875rem',
    fontWeight: 400,
    width: '100%',
    background: '#fff',
  }
  const sectionTitle: CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: muted,
    margin: '0 0 12px',
  }

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 400, color: '#111827', margin: 0 }}>
            Promo Codes
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: muted }}>
            Coupon codes that stack after automatic discounts.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={openCreate}
            style={{
              background: olive,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            data-testid="promo-open-create"
          >
            + New promo
          </button>
        )}
      </div>

      {open && (
        <form
          onSubmit={savePromo}
          data-testid={editingId ? 'promo-edit' : 'promo-create'}
          style={{
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: '24px 28px',
            background: '#fff',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 24,
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 500 }}>
              {editingId ? 'Edit promo' : 'New promo'}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '0.8125rem' }}
            >
              Collapse
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 32,
              alignItems: 'start',
            }}
            className="discount-create-grid"
          >
            <div style={{ display: 'grid', gap: 28 }}>
              <div>
                <p style={sectionTitle}>Basics</p>
                <div style={{ display: 'grid', gap: 16 }}>
                  <label style={field}>
                    Code
                    <input
                      style={{ ...control, textTransform: 'uppercase' }}
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="WELCOME10"
                      required
                      disabled={codeLocked}
                    />
                    {codeLocked && (
                      <span style={{ fontWeight: 400, fontSize: '0.75rem', color: muted }}>
                        Code locked — already redeemed
                      </span>
                    )}
                  </label>
                  <label style={field}>
                    Description <span style={{ fontWeight: 400, color: muted }}>(optional)</span>
                    <input
                      style={control}
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="e.g. Launch offer"
                    />
                  </label>
                  <label style={field}>
                    Type
                    <select
                      style={control}
                      value={form.kind}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          kind: e.target.value as PromoKind,
                          value: e.target.value === 'FREE_DELIVERY' ? '' : f.value,
                        }))
                      }
                    >
                      <option value="PERCENT">% off merchandise</option>
                      <option value="FLAT">₹ off merchandise</option>
                      <option value="FREE_DELIVERY">Free delivery</option>
                      <option value="MAKING_PERCENT">% off making charges</option>
                      <option value="MAKING_FLAT">₹ off making charges</option>
                    </select>
                  </label>
                  {form.kind !== 'FREE_DELIVERY' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <label style={field}>
                        Value
                        <input
                          style={control}
                          type="number"
                          min="1"
                          max={
                            form.kind === 'PERCENT' || form.kind === 'MAKING_PERCENT'
                              ? 100
                              : undefined
                          }
                          value={form.value}
                          onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                          placeholder={
                            form.kind === 'PERCENT' || form.kind === 'MAKING_PERCENT'
                              ? '10'
                              : '2000'
                          }
                          required
                        />
                      </label>
                      {(form.kind === 'PERCENT' || form.kind === 'MAKING_PERCENT') && (
                        <label style={field}>
                          Max discount ₹{' '}
                          <span style={{ fontWeight: 400, color: muted }}>(optional)</span>
                          <input
                            style={control}
                            type="number"
                            min="0"
                            value={form.maxDiscount}
                            onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
                            placeholder="cap"
                          />
                        </label>
                      )}
                    </div>
                  )}
                  {form.kind === 'FREE_DELIVERY' && (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: muted }}>
                      Discount equals the delivery amount included in product price (hallmarking /
                      misc), capped by what’s left after automatic discounts.
                    </p>
                  )}
                  {(form.kind === 'MAKING_PERCENT' || form.kind === 'MAKING_FLAT') && (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: muted }}>
                      Discount is the lesser of the coupon amount and actual making charges (incl.
                      GST share).
                    </p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={field}>
                      Min order ₹
                      <input
                        style={control}
                        type="number"
                        min="0"
                        value={form.minOrderValue}
                        onChange={(e) => setForm((f) => ({ ...f, minOrderValue: e.target.value }))}
                      />
                    </label>
                    <label style={field}>
                      Per user
                      <input
                        style={control}
                        type="number"
                        min="1"
                        value={form.maxPerUser}
                        onChange={(e) => setForm((f) => ({ ...f, maxPerUser: e.target.value }))}
                      />
                    </label>
                  </div>
                  <label style={field}>
                    Total uses <span style={{ fontWeight: 400, color: muted }}>(optional)</span>
                    <input
                      style={control}
                      type="number"
                      min="1"
                      value={form.maxRedemptions}
                      onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
                      placeholder="∞"
                    />
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.firstOrderOnly}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, firstOrderOnly: e.target.checked }))
                      }
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      <strong style={{ fontWeight: 600 }}>First order only</strong>
                      <span style={{ display: 'block', color: muted, fontSize: '0.75rem', marginTop: 2 }}>
                        Rejects customers who have already paid for an order
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <p style={sectionTitle}>Schedule</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={field}>
                    Starts
                    <input
                      style={control}
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                    />
                  </label>
                  <label style={field}>
                    Ends
                    <input
                      style={control}
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                    />
                  </label>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: muted }}>
                  Leave blank to keep it always on.
                </p>
              </div>

              <p style={{ margin: 0, fontSize: '0.75rem', color: muted }}>
                Applies after automatic discounts.
              </p>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    background: olive,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 18px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: busy ? 'wait' : 'pointer',
                  }}
                >
                  {busy ? 'Saving…' : editingId ? 'Update promo' : 'Save promo'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: muted,
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                  }}
                >
                  Cancel
                </button>
              </div>
              {error && <p style={{ margin: 0, color: '#dc2626', fontSize: '0.8125rem' }}>{error}</p>}
            </div>

            <div
              style={{
                borderLeft: `1px solid ${border}`,
                paddingLeft: 32,
                minHeight: 280,
              }}
            >
              <p style={sectionTitle}>Who gets this</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {(
                  [
                    {
                      id: 'everyone' as const,
                      title: 'Everyone',
                      body: 'Whole cart (all products)',
                    },
                    {
                      id: 'specific' as const,
                      title: 'Specific products',
                      body: 'Choose categories or items',
                    },
                  ] as const
                ).map((opt) => {
                  const selected = form.scopeMode === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          scopeMode: opt.id,
                          scope: opt.id === 'everyone' ? EMPTY_SCOPE : f.scope,
                          scopeSearch: '',
                        }))
                      }
                      style={{
                        textAlign: 'left',
                        padding: '14px 16px',
                        borderRadius: 10,
                        border: `1.5px solid ${selected ? olive : border}`,
                        background: selected ? 'rgba(94, 104, 78, 0.06)' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
                        {opt.title}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: muted, marginTop: 2 }}>{opt.body}</div>
                    </button>
                  )
                })}
              </div>

              {form.scopeMode === 'specific' && (
                <div style={{ marginTop: 16, display: 'grid', gap: 14 }}>
                  <div>
                    <p style={{ ...sectionTitle, marginBottom: 8 }}>Categories</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {CATEGORY_OPTIONS.map((c) => {
                        const on = form.scope.categories.includes(c.value)
                        return (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                scope: {
                                  ...f.scope,
                                  categories: on
                                    ? f.scope.categories.filter((x) => x !== c.value)
                                    : [...f.scope.categories, c.value],
                                },
                              }))
                            }
                            style={{
                              padding: '6px 12px',
                              borderRadius: 999,
                              border: `1px solid ${on ? olive : border}`,
                              background: on ? olive : '#fff',
                              color: on ? '#fff' : '#374151',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            {c.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <label style={field}>
                    Search products or collections
                    <input
                      style={control}
                      value={form.scopeSearch}
                      onChange={(e) => setForm((f) => ({ ...f, scopeSearch: e.target.value }))}
                      placeholder="Name or item code…"
                    />
                  </label>

                  {form.scopeSearch.trim() && (
                    <div
                      style={{
                        border: `1px solid ${border}`,
                        borderRadius: 8,
                        maxHeight: 220,
                        overflowY: 'auto',
                      }}
                    >
                      {searchHits.collections.map((c) => (
                        <button
                          key={`c-${c.id}`}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              scope: {
                                ...f.scope,
                                collectionIds: [...f.scope.collectionIds, c.id],
                              },
                              scopeSearch: '',
                            }))
                          }
                          style={hitRow}
                        >
                          <span>Collection · {c.label}</span>
                          <span style={{ color: olive, fontWeight: 600 }}>+ Add</span>
                        </button>
                      ))}
                      {searchHits.storeCategories.map((c) => (
                        <button
                          key={`s-${c.id}`}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              scope: {
                                ...f.scope,
                                storeCategoryIds: [...f.scope.storeCategoryIds, c.id],
                              },
                              scopeSearch: '',
                            }))
                          }
                          style={hitRow}
                        >
                          <span>Store · {c.label}</span>
                          <span style={{ color: olive, fontWeight: 600 }}>+ Add</span>
                        </button>
                      ))}
                      {searchHits.products.map((p) => (
                        <button
                          key={`p-${p.id}`}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              scope: { ...f.scope, productIds: [...f.scope.productIds, p.id] },
                              scopeSearch: '',
                            }))
                          }
                          style={hitRow}
                        >
                          <span>{p.label}</span>
                          <span style={{ color: olive, fontWeight: 600 }}>+ Add</span>
                        </button>
                      ))}
                      {!searchHits.products.length &&
                        !searchHits.collections.length &&
                        !searchHits.storeCategories.length && (
                          <div style={{ padding: 12, fontSize: '0.75rem', color: muted }}>No matches</div>
                        )}
                    </div>
                  )}

                  {(form.scope.productIds.length > 0 ||
                    form.scope.collectionIds.length > 0 ||
                    form.scope.storeCategoryIds.length > 0) && (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {form.scope.collectionIds.map((id) => (
                        <SelectedRow
                          key={`sc-${id}`}
                          label={`Collection · ${collections.find((c) => c.id === id)?.label ?? id}`}
                          onRemove={() =>
                            setForm((f) => ({
                              ...f,
                              scope: {
                                ...f.scope,
                                collectionIds: f.scope.collectionIds.filter((x) => x !== id),
                              },
                            }))
                          }
                        />
                      ))}
                      {form.scope.storeCategoryIds.map((id) => (
                        <SelectedRow
                          key={`ss-${id}`}
                          label={`Store · ${storeCategories.find((c) => c.id === id)?.label ?? id}`}
                          onRemove={() =>
                            setForm((f) => ({
                              ...f,
                              scope: {
                                ...f.scope,
                                storeCategoryIds: f.scope.storeCategoryIds.filter((x) => x !== id),
                              },
                            }))
                          }
                        />
                      ))}
                      {form.scope.productIds.map((id) => (
                        <SelectedRow
                          key={`sp-${id}`}
                          label={products.find((p) => p.id === id)?.label ?? id}
                          onRemove={() =>
                            setForm((f) => ({
                              ...f,
                              scope: {
                                ...f.scope,
                                productIds: f.scope.productIds.filter((x) => x !== id),
                              },
                            }))
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gap: 0 }}>
        {initial.length === 0 && !open && (
          <p style={{ color: muted, fontSize: '0.875rem', padding: '24px 0' }}>
            No promo codes yet.
          </p>
        )}
        {initial.map((row) => (
          <div
            key={row.id}
            data-testid="promo-row"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              padding: '18px 0',
              borderBottom: `1px solid ${border}`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827' }}>{row.code}</div>
              <div style={{ fontSize: '0.8125rem', color: muted, marginTop: 2 }}>
                {row.description ? `${row.description} · ` : ''}
                {row.firstOrderOnly ? 'First order · ' : ''}
                {scopeLabel(row)} · {scheduleLabel(row)} · used {row.redemptionCount}
                {row.maxRedemptions != null ? ` / ${row.maxRedemptions}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
              <span style={{ fontSize: '1.125rem', fontWeight: 500, color: olive }}>
                {promoKindListLabel(row.kind, row.value, row.maxDiscount)}
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: row.active ? 'rgba(94, 104, 78, 0.12)' : '#f3f4f6',
                  color: row.active ? olive : muted,
                }}
              >
                {row.active ? 'Active' : 'Off'}
              </span>
              <button
                type="button"
                onClick={() => openEdit(row)}
                style={{ background: 'none', border: 'none', color: olive, cursor: 'pointer', fontSize: '0.75rem' }}
                data-testid="promo-edit-btn"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => toggleActive(row)}
                style={{ background: 'none', border: 'none', color: olive, cursor: 'pointer', fontSize: '0.75rem' }}
              >
                {row.active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={() => remove(row)}
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                {row.redemptionCount > 0 ? 'Retire' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const hitRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  width: '100%',
  padding: '10px 12px',
  border: 'none',
  borderBottom: `1px solid ${border}`,
  background: '#fff',
  cursor: 'pointer',
  fontSize: '0.8125rem',
  textAlign: 'left',
}

function SelectedRow({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        border: `1px solid ${border}`,
        borderRadius: 8,
        fontSize: '0.8125rem',
      }}
    >
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '0.75rem' }}
      >
        Remove
      </button>
    </div>
  )
}
