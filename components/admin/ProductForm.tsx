'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ImageUploader from './ImageUploader'
import { AdminProductGalleryPreview } from './AdminProductGalleryPreview'
import { ProductFilterLabelsEditor } from './ProductFilterLabelsEditor'
import { calculatePrice, type PricingConfig, type StoneInput } from '@/lib/pricing'
import { parseInvoiceReturnTo, invoiceReturnWithVariant } from '@/lib/invoice-return'

export type CategoryOption = { slug: string; name: string }

const DEFAULT_CATEGORIES: CategoryOption[] = [
  { slug: 'rings', name: 'Rings' },
  { slug: 'earrings', name: 'Earrings' },
  { slug: 'pendants', name: 'Pendants' },
  { slug: 'bracelets', name: 'Bracelets' },
  { slug: 'mangalsutra', name: 'Mangalsutra' },
  { slug: 'necklaces', name: 'Necklaces' },
]

const METAL_TYPES = [
  { value: 'GOLD_18K', label: '18kt Gold', skuSuffix: 'G18K', badgeColor: '#fef08a', badgeText: '#854d0e', badgeBorder: '#fde047' },
  { value: 'GOLD_14K', label: '14kt Gold', skuSuffix: 'G14K', badgeColor: '#fef9c3', badgeText: '#a16207', badgeBorder: '#fef08a' },
  { value: 'ROSE_GOLD', label: 'Rose Gold 18kt', skuSuffix: 'RG', badgeColor: '#ffe4e6', badgeText: '#be123c', badgeBorder: '#fecdd3' },
]

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', hint: 'Not visible on store. Only title is required.' },
  { value: 'AI_DRAFT', label: 'AI Draft', hint: 'Machine-generated draft — review before going live.' },
  { value: 'LIVE', label: 'Live', hint: 'Visible & purchasable on storefront. Needs ≥1 variant.' },
] as const

const PRICE_VISIBILITY_OPTIONS = [
  { value: 'INHERIT', label: 'Use global default', hint: 'Follows storefront-wide setting in Pricing Settings.' },
  { value: 'SHOW', label: 'Always show price', hint: 'Shows the computed price regardless of global setting.' },
  { value: 'HIDE', label: 'Always hide (Price on Request)', hint: 'No checkout price shown — WhatsApp enquiry only.' },
] as const

const FALLBACK_RATES: Record<string, number> = {
  GOLD_18K: 5100,
  GOLD_14K: 3967,
  ROSE_GOLD: 5100,
}

function buildSku(itemCode: string, metalType: string, size?: string): string {
  if (!itemCode) return ''
  const suffix = METAL_TYPES.find((m) => m.value === metalType)?.skuSuffix ?? metalType
  const sizePart = size?.trim() ? `-${size.trim().toUpperCase().replace(/\s+/g, '')}` : ''
  return `${itemCode.toUpperCase()}-${suffix}${sizePart}`
}

type Variant = {
  metalType: string
  size: string
  weightGrams: string
  makingChargePerGram: string
  flatMakingCharge: string
  stoneCharges: string
  miscCharges: string
  stock: string
  sku: string
}

type FormStone = {
  diamondRateId: string
  caratWeight: string
  count: string
  label: string
}

export type DiamondRateOption = {
  id: string
  label: string
  ratePerCarat: number
  ratePerCaratExchange: number
}

type FormData = {
  name: string
  description: string
  category: string
  itemCode: string
  designStyle: string
  totalLengthMm: string
  motifSizeMm: string
  thicknessMm: string
  stoneType: string
  stoneShape: string
  stoneDimMm: string
  gemCount: string
  caratWeight: string
  images: string[]
  variants: Variant[]
  stones: FormStone[]
  isActive: boolean
  comingSoon: boolean
  status: 'DRAFT' | 'AI_DRAFT' | 'LIVE'
  priority: string | number
  priceVisibility: 'INHERIT' | 'SHOW' | 'HIDE'
  labels?: string[]
}

type Props = {
  initialData?: Partial<FormData> & { id?: string; labels?: string[] }
  mode: 'create' | 'edit'
  diamondRates: DiamondRateOption[]
  goldRates?: Record<string, number>
  pricingConfig?: PricingConfig
  categories?: CategoryOption[]
  allCategoryFilters?: Record<string, any>
  returnTo?: string
}

function emptyVariant(): Variant {
  return {
    metalType: 'GOLD_18K',
    size: '',
    weightGrams: '',
    makingChargePerGram: '',
    flatMakingCharge: '0',
    stoneCharges: '0',
    miscCharges: '45',
    stock: '0',
    sku: '',
  }
}

function emptyStone(diamondRates: DiamondRateOption[]): FormStone {
  return {
    diamondRateId: diamondRates[0]?.id ?? '',
    caratWeight: '',
    count: '',
    label: '',
  }
}

function initialForm(data?: Partial<FormData>): FormData {
  return {
    name: data?.name ?? '',
    description: data?.description ?? '',
    category: data?.category ?? 'RINGS',
    itemCode: data?.itemCode ?? '',
    designStyle: data?.designStyle ?? '',
    totalLengthMm: data?.totalLengthMm ?? '',
    motifSizeMm: data?.motifSizeMm ?? '',
    thicknessMm: data?.thicknessMm ?? '',
    stoneType: data?.stoneType ?? '',
    stoneShape: data?.stoneShape ?? '',
    stoneDimMm: data?.stoneDimMm ?? '',
    gemCount: data?.gemCount ?? '',
    caratWeight: data?.caratWeight ?? '',
    images: data?.images ?? [],
    variants: data?.variants?.length ? (data.variants as Variant[]) : [emptyVariant()],
    stones: data?.stones ?? [],
    isActive: data?.isActive ?? true,
    comingSoon: data?.comingSoon ?? false,
    status: data?.status ?? 'DRAFT',
    priority: data?.priority !== undefined ? String(data.priority) : '0',
    priceVisibility: data?.priceVisibility ?? 'INHERIT',
    labels: data?.labels ?? [],
  }
}

type TabKey = 'all' | 'general' | 'media' | 'labels' | 'variants' | 'specs'

export default function ProductForm({
  initialData,
  mode,
  diamondRates,
  goldRates,
  pricingConfig,
  categories: initialCategories,
  allCategoryFilters,
  returnTo,
}: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(() => initialForm(initialData))
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [filtersMap, setFiltersMap] = useState<Record<string, any>>(allCategoryFilters ?? {})
  const [categoryList, setCategoryList] = useState<CategoryOption[]>(
    initialCategories && initialCategories.length > 0 ? initialCategories : DEFAULT_CATEGORIES
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!allCategoryFilters || Object.keys(allCategoryFilters).length === 0) {
      fetch('/api/admin/filters')
        .then((res) => (res.ok ? res.json() : null))
        .then((res) => {
          if (res?.data) setFiltersMap(res.data)
        })
        .catch(() => {})
    }
  }, [allCategoryFilters])

  useEffect(() => {
    fetch('/api/admin/categories')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCategoryList(data.map((c) => ({ slug: c.slug, name: c.name })))
        }
      })
      .catch(() => {})
  }, [])

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categoryList) {
      map.set(c.slug.toUpperCase(), c.name)
    }
    if (form.category && !map.has(form.category.toUpperCase())) {
      const raw = form.category
      const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase().replace(/_/g, ' ')
      map.set(raw.toUpperCase(), label)
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [categoryList, form.category])

  const currentCategorySlug = (form.category || '').toLowerCase().trim()
  const currentCategoryConfig =
    filtersMap[currentCategorySlug] ||
    filtersMap[currentCategorySlug.replace(/s$/, '')] ||
    filtersMap[`${currentCategorySlug}s`]
  const availableLabels: string[] = currentCategoryConfig?.labels || []

  const rates = goldRates && Object.keys(goldRates).length ? goldRates : FALLBACK_RATES
  const isDraft = form.status !== 'LIVE'

  const stoneInputs = form.stones.flatMap((s): StoneInput[] => {
    const rate = diamondRates.find((r) => r.id === s.diamondRateId)
    const carat = parseFloat(s.caratWeight)
    if (!rate || !carat || carat <= 0) return []
    return [
      {
        caratWeight: carat,
        ratePerCarat: rate.ratePerCarat,
        ratePerCaratExchange: rate.ratePerCaratExchange,
        typeLabel: rate.label,
      },
    ]
  })

  function calcEstimatedPrice(v: Variant, withExchange: boolean): number | null {
    const weight = parseFloat(v.weightGrams)
    if (!weight || weight <= 0) return null
    return Math.round(
      calculatePrice(
        {
          weightGrams: weight,
          makingChargePerGram: parseFloat(v.makingChargePerGram) || 0,
          flatMakingCharge: parseFloat(v.flatMakingCharge) || 0,
          stoneCharges: parseFloat(v.stoneCharges) || 0,
          miscCharges: parseFloat(v.miscCharges) || 0,
        },
        rates[v.metalType] ?? 0,
        { stones: stoneInputs, withExchange, config: pricingConfig }
      ).total
    )
  }

  // Quick summary computations
  const totalStock = useMemo(() => {
    return form.variants.reduce((acc, v) => acc + (parseInt(v.stock, 10) || 0), 0)
  }, [form.variants])

  const minEstimatedPrice = useMemo(() => {
    let min: number | null = null
    for (const v of form.variants) {
      const p = calcEstimatedPrice(v, false)
      if (p !== null && (min === null || p < min)) {
        min = p
      }
    }
    return min
  }, [form.variants, stoneInputs, rates, pricingConfig])

  const currentCategoryName = useMemo(() => {
    return categoryOptions.find((c) => c.value === form.category.toUpperCase())?.label || form.category
  }, [categoryOptions, form.category])

  function set<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((f) => {
      const next = { ...f, [field]: value }
      if (field === 'itemCode') {
        next.variants = f.variants.map((v) => ({
          ...v,
          sku: buildSku(value as string, v.metalType, v.size),
        }))
      }
      return next
    })
  }

  function setVariant(idx: number, field: keyof Variant, value: string) {
    setForm((f) => {
      const v = [...f.variants]
      const prev = v[idx]
      v[idx] = { ...prev, [field]: value }
      if ((field === 'metalType' || field === 'size') && f.itemCode) {
        const wasAuto = !prev.sku || prev.sku === buildSku(f.itemCode, prev.metalType, prev.size)
        if (wasAuto) v[idx].sku = buildSku(f.itemCode, v[idx].metalType, v[idx].size)
      }
      return { ...f, variants: v }
    })
  }

  function addVariant() {
    const nv = emptyVariant()
    nv.sku = buildSku(form.itemCode, nv.metalType)
    setForm((f) => ({ ...f, variants: [...f.variants, nv] }))
  }

  function removeVariant(idx: number) {
    setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }))
  }

  function setStone(idx: number, field: keyof FormStone, value: string) {
    setForm((f) => {
      const s = [...f.stones]
      s[idx] = { ...s[idx], [field]: value }
      return { ...f, stones: s }
    })
  }

  function addStone() {
    setForm((f) => ({ ...f, stones: [...f.stones, emptyStone(diamondRates)] }))
  }

  function removeStone(idx: number) {
    setForm((f) => ({ ...f, stones: f.stones.filter((_, i) => i !== idx) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    for (const v of form.variants) {
      if (v.makingChargePerGram !== '' && parseFloat(v.makingChargePerGram) < 0) {
        setError('Making Charge cannot be negative.')
        return
      }
    }

    setSaving(true)
    setError('')

    const variants = isDraft
      ? form.variants.filter((v) => v.sku.trim() || parseFloat(v.weightGrams) > 0)
      : form.variants

    const stones = form.stones.filter((s) => parseFloat(s.caratWeight) > 0 && s.diamondRateId)

    const payload = {
      ...form,
      priority: parseInt(String(form.priority), 10) || 0,
      variants,
      stones,
      images: form.images.filter(Boolean),
      labels: form.labels,
    }

    const url = mode === 'create' ? '/api/admin/products' : `/api/admin/products/${initialData?.id}`
    const res = await fetch(url, {
      method: mode === 'create' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Save failed')
      return
    }

    const created = await res.json().catch(() => ({}))
    const safeReturn = parseInvoiceReturnTo(returnTo)
    const variantId = created?.variants?.[0]?.id as string | undefined
    if (mode === 'create' && safeReturn && variantId) {
      router.push(invoiceReturnWithVariant(safeReturn, variantId))
    } else if (mode === 'create' && safeReturn) {
      router.push(safeReturn)
    } else {
      router.push('/admin/products')
    }
    router.refresh()
  }

  const primaryImage = form.images.find(Boolean)

  const TABS = [
    { id: 'all' as TabKey, label: 'All Sections', icon: '📌' },
    { id: 'general' as TabKey, label: 'Basic Info', icon: '📝' },
    { id: 'media' as TabKey, label: 'Images', icon: '🖼️', count: form.images.filter(Boolean).length },
    { id: 'labels' as TabKey, label: 'Filter Labels', icon: '🏷️', count: (form.labels ?? []).length },
    { id: 'variants' as TabKey, label: 'Variants & Pricing', icon: '💍', count: form.variants.length },
    { id: 'specs' as TabKey, label: 'Specs & Diamonds', icon: '💎', count: form.stones.length },
  ]

  return (
    <form onSubmit={handleSubmit} className="pform" style={{ maxWidth: '100%' }}>
      {/* ─── STICKY HERO ACTION BAR ─── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 35,
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e5e7eb',
          padding: '12px 16px',
          margin: '-1rem -1rem 1.25rem -1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <Link
            href={returnTo ?? '/admin/products'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '0.8125rem',
              color: '#6b7280',
              textDecoration: 'none',
              padding: '4px 8px',
              borderRadius: '4px',
              background: '#f3f4f6',
            }}
          >
            ← {returnTo ? 'Invoice' : 'Products'}
          </Link>

          {primaryImage ? (
            <img
              src={primaryImage}
              alt=""
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                objectFit: 'cover',
                border: '1px solid #e5e7eb',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                background: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                border: '1px solid #e5e7eb',
                flexShrink: 0,
              }}
            >
              💍
            </div>
          )}

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '1.0625rem',
                  fontWeight: 600,
                  color: '#111827',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '340px',
                }}
              >
                {form.name || (mode === 'create' ? 'New Product' : 'Untitled Product')}
              </span>

              {/* Status Badge */}
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background:
                    form.status === 'LIVE'
                      ? '#ecfdf5'
                      : form.status === 'DRAFT'
                      ? '#fefce8'
                      : '#f5f3ff',
                  color:
                    form.status === 'LIVE'
                      ? '#065f46'
                      : form.status === 'DRAFT'
                      ? '#854d0e'
                      : '#5b21b6',
                  border: `1px solid ${
                    form.status === 'LIVE'
                      ? '#a7f3d0'
                      : form.status === 'DRAFT'
                      ? '#fef08a'
                      : '#ddd6fe'
                  }`,
                }}
              >
                {form.status}
              </span>

              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                }}
              >
                {currentCategoryName}
              </span>

              {form.itemCode && (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: '#4b5563',
                    background: '#f3f4f6',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                  }}
                >
                  {form.itemCode}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {mode === 'edit' && initialData?.id && (
            <Link
              href={`/product/${initialData.id}`}
              target="_blank"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '7px 12px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: '#374151',
                background: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                textDecoration: 'none',
              }}
            >
              View in Store ↗
            </Link>
          )}

          <button
            type="submit"
            disabled={saving}
            className="pform__submit"
            style={{
              padding: '7px 18px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              borderRadius: 6,
              background: saving ? '#9ca3af' : '#111827',
              color: '#ffffff',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            }}
          >
            {saving ? 'Saving…' : mode === 'create' ? 'Create Product' : 'Save Changes'}
          </button>

          <button
            type="button"
            onClick={() => {
              const back = parseInvoiceReturnTo(returnTo)
              if (back) router.push(back)
              else router.back()
            }}
            className="pform__cancel"
            style={{
              padding: '7px 12px',
              fontSize: '0.8125rem',
              color: '#6b7280',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* ─── EXECUTIVE KPI / STATS BAR ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
            Store Publishing
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginTop: '2px' }}>
            {form.status === 'LIVE' ? '🟢 Live on Store' : form.status === 'DRAFT' ? '🟡 Hidden (Draft)' : '🟣 AI Draft'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
            {form.priceVisibility === 'SHOW'
              ? 'Always show price'
              : form.priceVisibility === 'HIDE'
              ? 'WhatsApp Enquiry only'
              : 'Inherits global pricing setting'}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
            Category &amp; Priority
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginTop: '2px' }}>
            {currentCategoryName}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
            Display Priority: #{form.priority || 0} · {(form.labels ?? []).length} filter labels
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
            Variants &amp; Stock
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginTop: '2px' }}>
            {form.variants.length} Metal Options
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
            {totalStock} units available across sizes
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
            Est. Starting Retail
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginTop: '2px' }}>
            {minEstimatedPrice ? `₹${minEstimatedPrice.toLocaleString('en-IN')}` : 'Price on Request'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
            {form.stones.length > 0 ? `${form.stones.length} diamond entries included` : 'Pure gold jewellery item'}
          </div>
        </div>
      </div>

      {/* ─── SEGMENTED SECTION TABS (ELIMINATES LENGTHY SCROLLING) ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '1rem',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 600 : 500,
                background: isActive ? '#111827' : '#ffffff',
                color: isActive ? '#ffffff' : '#374151',
                border: isActive ? '1px solid #111827' : '1px solid #e5e7eb',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    padding: '1px 5px',
                    borderRadius: '9999px',
                    background: isActive ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
                    color: isActive ? '#ffffff' : '#6b7280',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {/* ─── SECTION 1: BASIC INFORMATION ─── */}
      {(activeTab === 'all' || activeTab === 'general') && (
        <section
          className="pform__section"
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111827', margin: 0 }}>
              📝 Basic Information
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Core title, item code, category and publishing rules</span>
          </div>

          <div className="pform__grid pform__grid--2">
            <div className="pform__field">
              <label htmlFor="pf-name">Product Name *</label>
              <input
                id="pf-name"
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className="pform__input"
                placeholder="e.g. Heart Diamond Bracelet"
              />
            </div>
            <div className="pform__field">
              <label htmlFor="pf-itemcode">Item Code</label>
              <input
                id="pf-itemcode"
                value={form.itemCode}
                onChange={(e) => set('itemCode', e.target.value)}
                className="pform__input"
                placeholder="e.g. AJBR-74"
              />
            </div>
          </div>

          <div className="pform__grid pform__grid--2">
            <div className="pform__field">
              <label htmlFor="pf-category">Category *</label>
              <select
                id="pf-category"
                required
                value={form.category.toUpperCase()}
                onChange={(e) => set('category', e.target.value)}
                className="pform__input"
                data-testid="product-category"
              >
                {categoryOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pform__field">
              <label htmlFor="pf-status">Status *</label>
              <select
                id="pf-status"
                value={form.status}
                onChange={(e) => set('status', e.target.value as FormData['status'])}
                className="pform__input"
                data-testid="product-status"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="pform__hint">
                {STATUS_OPTIONS.find((s) => s.value === form.status)?.hint}
              </p>
            </div>
          </div>

          <div className="pform__grid pform__grid--2">
            <div className="pform__field">
              <label htmlFor="pf-price-visibility">Price Visibility</label>
              <select
                id="pf-price-visibility"
                value={form.priceVisibility}
                onChange={(e) => set('priceVisibility', e.target.value as FormData['priceVisibility'])}
                className="pform__input"
                data-testid="product-price-visibility"
              >
                {PRICE_VISIBILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="pform__hint">
                {PRICE_VISIBILITY_OPTIONS.find((o) => o.value === form.priceVisibility)?.hint}
              </p>
            </div>
            <div className="pform__field">
              <label htmlFor="pf-priority">Display Priority</label>
              <input
                id="pf-priority"
                type="number"
                min="0"
                step="1"
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
                className="pform__input"
                placeholder="0"
                data-testid="product-priority"
              />
              <p className="pform__hint">
                Controls storefront order. Priority 0 appears first, followed by 1, 2, etc.
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              padding: '12px 14px',
              background: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
            }}
          >
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8125rem', color: '#374151' }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
              />
              <span style={{ fontWeight: 500 }}>Active in catalogue reel</span>
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8125rem', color: '#374151' }}>
              <input
                type="checkbox"
                checked={form.comingSoon}
                onChange={(e) => set('comingSoon', e.target.checked)}
              />
              <span style={{ fontWeight: 500 }}>Coming Soon (Notify Me button)</span>
            </label>
          </div>

          <div className="pform__field">
            <label htmlFor="pf-description">Description</label>
            <textarea
              id="pf-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="pform__input"
              placeholder="Brief product description"
            />
          </div>

          <div className="pform__field">
            <label htmlFor="pf-designstyle">Design Style</label>
            <textarea
              id="pf-designstyle"
              value={form.designStyle}
              onChange={(e) => set('designStyle', e.target.value)}
              rows={2}
              className="pform__input"
              placeholder="e.g. Alternating open heart motifs and bezel-set round stones"
            />
          </div>
        </section>
      )}

      {/* ─── SECTION 2: PRODUCT IMAGES ─── */}
      {(activeTab === 'all' || activeTab === 'media') && (
        <section
          className="pform__section"
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111827', margin: 0 }}>
              🖼️ Product Images
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {form.images.filter(Boolean).length} uploaded · Drag to reorder
            </span>
          </div>
          <ImageUploader images={form.images} onChange={(imgs) => set('images', imgs)} />
          <AdminProductGalleryPreview
            images={form.images}
            productName={form.name || 'Product'}
            onChange={(imgs) => set('images', imgs)}
          />
        </section>
      )}

      {/* ─── SECTION 3: FILTER LABELS & TAGS ─── */}
      {(activeTab === 'all' || activeTab === 'labels') && (
        <section
          className="pform__section"
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111827', margin: 0 }}>
              🏷️ Category Filter Labels &amp; Tags
            </h2>
            <Link
              href="/admin/filters"
              target="_blank"
              style={{ fontSize: '0.75rem', color: '#4f46e5', textDecoration: 'none', fontWeight: 500 }}
            >
              Category Filters Manager ↗
            </Link>
          </div>

          <ProductFilterLabelsEditor
            key={`${initialData?.id ?? 'new'}-${form.category}`}
            productId={initialData?.id ?? ''}
            category={currentCategoryConfig?.categoryName || form.category}
            initialLabels={form.labels ?? []}
            availableLabels={availableLabels}
            onLabelsChange={(newLabels) => set('labels', newLabels)}
            showSaveButton={mode === 'edit' && Boolean(initialData?.id)}
          />
        </section>
      )}

      {/* ─── SECTION 4: METAL VARIANTS & PRICING ─── */}
      {(activeTab === 'all' || activeTab === 'variants') && (
        <section
          className="pform__section"
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div className="pform__variant-head" style={{ marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111827', margin: 0 }}>
                💍 Metal Variants &amp; Pricing
              </h2>
              <p className="pform__section-note" style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                Add one row per metal choice you offer. Pricing fields determine the retail price shown to customers.
              </p>
            </div>
            <button
              type="button"
              onClick={addVariant}
              className="pform__addvariant"
              style={{
                padding: '6px 14px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '6px',
                background: '#111827',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + Add variant
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {form.variants.map((v, idx) => {
              const estimated = calcEstimatedPrice(v, false)
              const estimatedExchange = calcEstimatedPrice(v, true)
              const makingHigh = parseFloat(v.makingChargePerGram) > 1500
              const stonesHigh = parseFloat(v.stoneCharges) > 500000
              const metalMeta = METAL_TYPES.find((m) => m.value === v.metalType)

              return (
                <div
                  key={idx}
                  className="pform__variant"
                  style={{
                    background: '#fcfcfd',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  {/* Variant Header Pill */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                      paddingBottom: '8px',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: metalMeta?.badgeColor ?? '#f3f4f6',
                          color: metalMeta?.badgeText ?? '#111827',
                          border: `1px solid ${metalMeta?.badgeBorder ?? '#e5e7eb'}`,
                        }}
                      >
                        Variant #{idx + 1}: {metalMeta?.label ?? v.metalType}
                      </span>
                      {v.sku && (
                        <span style={{ fontSize: '0.6875rem', color: '#6b7280', fontFamily: 'monospace' }}>
                          SKU: {v.sku}
                        </span>
                      )}
                    </div>
                    {form.variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(idx)}
                        className="pform__variant-remove"
                        aria-label="Remove variant"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}
                      >
                        Remove variant ×
                      </button>
                    )}
                  </div>

                  {/* Row 1: Identity */}
                  <div className="pform__grid pform__grid--12">
                    <div className="pform__field pform__span-3">
                      <label>Metal Type</label>
                      <select
                        value={v.metalType}
                        onChange={(e) => setVariant(idx, 'metalType', e.target.value)}
                        className="pform__input"
                      >
                        {METAL_TYPES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="pform__field pform__span-2">
                      <label>Size</label>
                      <input
                        value={v.size}
                        onChange={(e) => setVariant(idx, 'size', e.target.value)}
                        className="pform__input"
                        placeholder="e.g. 12 / M"
                        data-testid="variant-size"
                      />
                    </div>
                    <div className="pform__field pform__span-2">
                      <label>Weight (g)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={v.weightGrams}
                        onChange={(e) => setVariant(idx, 'weightGrams', e.target.value)}
                        className="pform__input"
                        placeholder="8.500"
                      />
                    </div>
                    <div className="pform__field pform__span-2">
                      <label>Stock</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        data-testid="variant-stock"
                        value={v.stock}
                        onChange={(e) => setVariant(idx, 'stock', e.target.value)}
                        className="pform__input"
                      />
                    </div>
                    <div className="pform__field pform__span-3">
                      <label>SKU</label>
                      <input
                        value={v.sku}
                        onChange={(e) => setVariant(idx, 'sku', e.target.value)}
                        className="pform__input"
                        placeholder="AJBR-74-G18K"
                      />
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="pform__pricing" style={{ marginTop: '12px', paddingTop: '10px' }}>
                    <p className="pform__pricing-head" style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Pricing Breakdown — Used to Compute Retail Price
                    </p>
                    <div className="pform__grid pform__grid--4">
                      <div className="pform__field">
                        <label>Making ₹/g</label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={v.makingChargePerGram}
                          onChange={(e) => setVariant(idx, 'makingChargePerGram', e.target.value)}
                          className={makingHigh ? 'pform__input pform__input--warn' : 'pform__input'}
                          placeholder="e.g. 400"
                        />
                        <p className="pform__hint">Labour per gram</p>
                        {makingHigh && <p className="pform__warn">⚠ Unusually high</p>}
                      </div>

                      <div className="pform__field">
                        <label>Flat Making (₹)</label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={v.flatMakingCharge}
                          onChange={(e) => setVariant(idx, 'flatMakingCharge', e.target.value)}
                          className="pform__input"
                          placeholder="0"
                        />
                        <p className="pform__hint">Fixed clasp/engraving</p>
                      </div>

                      <div className="pform__field">
                        <label>Stone Charges (₹)</label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={v.stoneCharges}
                          onChange={(e) => setVariant(idx, 'stoneCharges', e.target.value)}
                          className={stonesHigh ? 'pform__input pform__input--warn' : 'pform__input'}
                          placeholder="0"
                        />
                        <p className="pform__hint">Total gem cost</p>
                        {stonesHigh && <p className="pform__warn">⚠ Above ₹5L</p>}
                      </div>

                      <div className="pform__field">
                        <label>Misc (₹)</label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={v.miscCharges}
                          onChange={(e) => setVariant(idx, 'miscCharges', e.target.value)}
                          className="pform__input"
                          placeholder="45"
                        />
                        <p className="pform__hint">BIS hallmark (₹45)</p>
                      </div>
                    </div>
                  </div>

                  {/* Live calculated price banner */}
                  {estimated !== null && (
                    <div
                      className="pform__estimate"
                      style={{
                        marginTop: '12px',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#166534' }}>
                        Computed Retail Price ({metalMeta?.label} · gold + labour{stoneInputs.length ? ' + diamonds' : ''}):
                      </span>
                      <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#14532d' }}>
                        ₹{estimated.toLocaleString('en-IN')}
                        {stoneInputs.length > 0 && estimatedExchange !== null && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#166534', marginLeft: 8 }}>
                            (with exchange ₹{estimatedExchange.toLocaleString('en-IN')})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ─── SECTION 5: DESIGN SPECIFICATIONS & DIAMONDS ─── */}
      {(activeTab === 'all' || activeTab === 'specs') && (
        <>
          {/* CAD Physical specs */}
          <section
            className="pform__section"
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111827', margin: '0 0 12px 0' }}>
              📐 Design Specifications
            </h2>
            <div className="pform__grid pform__grid--3">
              <div className="pform__field">
                <label htmlFor="pf-length">Total Length (mm)</label>
                <input
                  id="pf-length"
                  type="number"
                  step="0.01"
                  value={form.totalLengthMm}
                  onChange={(e) => set('totalLengthMm', e.target.value)}
                  className="pform__input"
                  placeholder="e.g. 152.4 (6 inch)"
                />
              </div>
              <div className="pform__field">
                <label htmlFor="pf-motif">Motif Size (mm)</label>
                <input
                  id="pf-motif"
                  type="number"
                  step="0.01"
                  value={form.motifSizeMm}
                  onChange={(e) => set('motifSizeMm', e.target.value)}
                  className="pform__input"
                  placeholder="e.g. 9"
                />
              </div>
              <div className="pform__field">
                <label htmlFor="pf-thickness">Thickness/Depth (mm)</label>
                <input
                  id="pf-thickness"
                  type="number"
                  step="0.01"
                  value={form.thicknessMm}
                  onChange={(e) => set('thicknessMm', e.target.value)}
                  className="pform__input"
                  placeholder="e.g. 2.7"
                />
              </div>
            </div>
          </section>

          {/* Gemstone */}
          <section
            className="pform__section"
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111827', margin: '0 0 12px 0' }}>
              💎 Gemstone Details
            </h2>
            <div className="pform__grid pform__grid--2">
              <div className="pform__field">
                <label htmlFor="pf-stonetype">Stone Type</label>
                <input
                  id="pf-stonetype"
                  value={form.stoneType}
                  onChange={(e) => set('stoneType', e.target.value)}
                  className="pform__input"
                  placeholder="e.g. Diamond"
                />
              </div>
              <div className="pform__field">
                <label htmlFor="pf-stoneshape">Stone Shape</label>
                <input
                  id="pf-stoneshape"
                  value={form.stoneShape}
                  onChange={(e) => set('stoneShape', e.target.value)}
                  className="pform__input"
                  placeholder="e.g. Round"
                />
              </div>
              <div className="pform__field">
                <label htmlFor="pf-stonedim">Stone Dimensions (mm)</label>
                <input
                  id="pf-stonedim"
                  value={form.stoneDimMm}
                  onChange={(e) => set('stoneDimMm', e.target.value)}
                  className="pform__input"
                  placeholder="e.g. 4.80 x 4.80"
                />
              </div>
              <div className="pform__field">
                <label htmlFor="pf-gemcount">Gem Count</label>
                <input
                  id="pf-gemcount"
                  type="number"
                  value={form.gemCount}
                  onChange={(e) => set('gemCount', e.target.value)}
                  className="pform__input"
                  placeholder="e.g. 5"
                />
              </div>
              <div className="pform__field">
                <label htmlFor="pf-carat">Total Carat Weight (ctw)</label>
                <input
                  id="pf-carat"
                  type="number"
                  step="0.01"
                  value={form.caratWeight}
                  onChange={(e) => set('caratWeight', e.target.value)}
                  className="pform__input"
                  placeholder="e.g. 2.00"
                />
              </div>
            </div>
          </section>

          {/* Diamonds (priced per carat) */}
          <section
            className="pform__section"
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div className="pform__variant-head" style={{ marginBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111827', margin: 0 }}>
                  Diamonds (priced per carat)
                </h2>
                <p className="pform__section-note" style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                  One row per diamond entry — e.g. centre stone &amp; accent stones. Priced from rates in Settings → Pricing.
                </p>
              </div>
              <button
                type="button"
                onClick={addStone}
                className="pform__addvariant"
                data-testid="add-stone"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: '#111827',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                + Add diamond
              </button>
            </div>

            {diamondRates.length === 0 && (
              <p className="pform__warn">
                No diamond rates configured — add types at Settings → Pricing first.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {form.stones.map((s, idx) => {
                const rate = diamondRates.find((r) => r.id === s.diamondRateId)
                const carat = parseFloat(s.caratWeight) || 0
                return (
                  <div
                    key={idx}
                    className="pform__variant"
                    data-testid="stone-row"
                    style={{
                      background: '#fcfcfd',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '14px',
                    }}
                  >
                    <div className="pform__grid pform__grid--12">
                      <div className="pform__field pform__span-3">
                        <label>Diamond Type</label>
                        <select
                          value={s.diamondRateId}
                          onChange={(e) => setStone(idx, 'diamondRateId', e.target.value)}
                          className="pform__input"
                        >
                          {diamondRates.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        {rate && (
                          <p className="pform__hint">
                            ₹{rate.ratePerCarat.toLocaleString('en-IN')}/ct · exch ₹
                            {rate.ratePerCaratExchange.toLocaleString('en-IN')}/ct
                          </p>
                        )}
                      </div>
                      <div className="pform__field pform__span-2">
                        <label>Carat (ct)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={s.caratWeight}
                          onChange={(e) => setStone(idx, 'caratWeight', e.target.value)}
                          className="pform__input"
                          placeholder="0.50"
                        />
                      </div>
                      <div className="pform__field pform__span-2">
                        <label>Count (optional)</label>
                        <input
                          type="number"
                          min="0"
                          value={s.count}
                          onChange={(e) => setStone(idx, 'count', e.target.value)}
                          className="pform__input"
                          placeholder="e.g. 5"
                        />
                      </div>
                      <div className="pform__field pform__span-4">
                        <label>Label (optional)</label>
                        <input
                          value={s.label}
                          onChange={(e) => setStone(idx, 'label', e.target.value)}
                          className="pform__input"
                          placeholder="e.g. Centre stone / Blue accents"
                        />
                      </div>
                      <div className="pform__span-1">
                        <button
                          type="button"
                          onClick={() => removeStone(idx)}
                          className="pform__variant-remove"
                          aria-label="Remove diamond"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 600,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {rate && carat > 0 && (
                      <div
                        className="pform__estimate"
                        style={{
                          marginTop: '8px',
                          padding: '6px 10px',
                          background: '#eff6ff',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          color: '#1e40af',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span className="pform__estimate-label">Stone value</span>
                        <span className="pform__estimate-value" style={{ fontWeight: 600 }}>
                          ₹{Math.round(carat * rate.ratePerCarat).toLocaleString('en-IN')} · exch ₹
                          {Math.round(carat * rate.ratePerCaratExchange).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      {/* ─── BOTTOM ACTION BAR ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeTab !== 'all' && (
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                background: 'transparent',
                border: '1px solid #d1d5db',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              View All Sections
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="submit"
            disabled={saving}
            className="pform__submit"
            style={{
              padding: '8px 20px',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: 6,
              background: saving ? '#9ca3af' : '#111827',
              color: '#ffffff',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : mode === 'create' ? 'Create Product' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => {
              const back = parseInvoiceReturnTo(returnTo)
              if (back) router.push(back)
              else router.back()
            }}
            className="pform__cancel"
            style={{
              padding: '8px 14px',
              fontSize: '0.875rem',
              color: '#6b7280',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}
