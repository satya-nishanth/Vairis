'use client'
import { useEffect, useMemo, useState } from 'react'
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
  { value: 'GOLD_18K', label: '18kt Gold', skuSuffix: 'G18K' },
  { value: 'GOLD_14K', label: '14kt Gold', skuSuffix: 'G14K' },
  { value: 'ROSE_GOLD', label: 'Rose Gold 18kt', skuSuffix: 'RG' },
]

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', hint: 'Not on store. Only a title is required.' },
  { value: 'AI_DRAFT', label: 'AI Draft', hint: 'Machine-generated draft — review before going live.' },
  { value: 'LIVE', label: 'Live', hint: 'Visible & purchasable on the store. Needs ≥1 variant.' },
] as const

const PRICE_VISIBILITY_OPTIONS = [
  { value: 'INHERIT', label: 'Use global default', hint: 'Follows the storefront-wide setting in Pricing Settings.' },
  { value: 'SHOW', label: 'Always show price', hint: 'Shows the computed price regardless of the global default.' },
  { value: 'HIDE', label: 'Always hide (Price on Request)', hint: 'No checkout price shown — WhatsApp enquiry only.' },
] as const

// Fallback rates if the gold-rate table is empty (dev) — real rates come in via props.
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

function initialForm(data?: Partial<FormData> & { labels?: string[] }): FormData {
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
    variants: data?.variants?.length ? data.variants as Variant[] : [emptyVariant()],
    stones: data?.stones ?? [],
    isActive: data?.isActive ?? true,
    comingSoon: data?.comingSoon ?? false,
    status: data?.status ?? 'DRAFT',
    priority: data?.priority !== undefined ? String(data.priority) : '0',
    priceVisibility: data?.priceVisibility ?? 'INHERIT',
    labels: data?.labels ?? [],
  }
}

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
  const [form, setForm] = useState<FormData>(initialForm(initialData))
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
        { stones: stoneInputs, withExchange, config: pricingConfig },
      ).total,
    )
  }

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

    // Making charge is optional — blank is treated as 0. Only block negatives.
    for (const v of form.variants) {
      if (v.makingChargePerGram !== '' && parseFloat(v.makingChargePerGram) < 0) {
        setError('Making Charge cannot be negative.')
        return
      }
    }

    setSaving(true)
    setError('')

    // Drafts: silently drop untouched variant stubs (no SKU + no weight).
    // LIVE keeps every row so the API can validate them properly.
    const variants = isDraft
      ? form.variants.filter((v) => v.sku.trim() || parseFloat(v.weightGrams) > 0)
      : form.variants

    // Drop stone rows without a carat value
    const stones = form.stones.filter((s) => parseFloat(s.caratWeight) > 0 && s.diamondRateId)

    // Drop empty Front/Left/Right/Back placeholders so storefront never gets "" src
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

  return (
    <form onSubmit={handleSubmit} className="pform">
      {/* Basic info */}
      <section className="pform__section">
        <h2>Basic Information</h2>

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
              Controls storefront order. Priority 0 appears first, followed by 1, 2, etc., then sorted alphabetically by name.
            </p>
          </div>
        </div>

        <div className="pform__grid pform__grid--2">
          <div className="pform__checks">
            <label className="pform__check">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
              />
              <span>Active (include in catalogue reel; store needs Live status)</span>
            </label>
            <label className="pform__check">
              <input
                type="checkbox"
                checked={form.comingSoon}
                onChange={(e) => set('comingSoon', e.target.checked)}
              />
              <span>Coming Soon</span>
            </label>
            {form.comingSoon && (
              <p className="pform__warn">
                Pricing optional — shown as &ldquo;Coming Soon&rdquo; with a Notify Me button. No price displayed.
              </p>
            )}
          </div>
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

        {/* Category Filter Labels */}
        <div style={{ marginTop: '1.25rem' }}>
          <ProductFilterLabelsEditor
            key={`${initialData?.id ?? 'new'}-${form.category}`}
            productId={initialData?.id ?? ''}
            category={currentCategoryConfig?.categoryName || form.category}
            initialLabels={form.labels ?? []}
            availableLabels={availableLabels}
            onLabelsChange={(newLabels) => set('labels', newLabels)}
            showSaveButton={mode === 'edit' && Boolean(initialData?.id)}
          />
        </div>
      </section>

      {/* Images */}
      <section className="pform__section">
        <h2>Product Images</h2>
        <ImageUploader images={form.images} onChange={(imgs) => set('images', imgs)} />
        <AdminProductGalleryPreview
          images={form.images}
          productName={form.name || 'Product'}
          onChange={(imgs) => set('images', imgs)}
        />
      </section>

      {/* Physical specs */}
      <section className="pform__section">
        <h2>Design Specifications</h2>
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
      <section className="pform__section">
        <h2>Gemstone Details</h2>
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
      <section className="pform__section">
        <div className="pform__variant-head">
          <div>
            <h2>Diamonds (priced per carat)</h2>
            <p className="pform__section-note">
              One row per diamond entry — e.g. a centre stone and its accent stones. Priced from
              the per-carat rates in Settings → Pricing (with / without exchange). Customers see
              type + carat; count &amp; label are optional.
            </p>
          </div>
          <button type="button" onClick={addStone} className="pform__addvariant" data-testid="add-stone">
            + Add diamond
          </button>
        </div>

        {diamondRates.length === 0 && (
          <p className="pform__warn">
            No diamond rates configured — add types at Settings → Pricing first.
          </p>
        )}

        {form.stones.map((s, idx) => {
          const rate = diamondRates.find((r) => r.id === s.diamondRateId)
          const carat = parseFloat(s.caratWeight) || 0
          return (
            <div key={idx} className="pform__variant" data-testid="stone-row">
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
                  >
                    ×
                  </button>
                </div>
              </div>
              {rate && carat > 0 && (
                <div className="pform__estimate">
                  <span className="pform__estimate-label">Stone value</span>
                  <span className="pform__estimate-value">
                    ₹{Math.round(carat * rate.ratePerCarat).toLocaleString('en-IN')} · exch ₹
                    {Math.round(carat * rate.ratePerCaratExchange).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </section>

      {/* Variants */}
      <section className="pform__section">
        <div className="pform__variant-head">
          <div>
            <h2>Metal Variants &amp; Pricing</h2>
            <p className="pform__section-note">
              Add one row per metal you offer. Pricing fields are used to calculate the retail price
              shown to customers.
            </p>
          </div>
          <button type="button" onClick={addVariant} className="pform__addvariant">
            + Add variant
          </button>
        </div>

        {form.variants.map((v, idx) => {
          const estimated = calcEstimatedPrice(v, false)
          const estimatedExchange = calcEstimatedPrice(v, true)
          const makingHigh = parseFloat(v.makingChargePerGram) > 1500
          const stonesHigh = parseFloat(v.stoneCharges) > 500000

          return (
            <div key={idx} className="pform__variant">
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
                  <p className="pform__hint">One row per size — weight differs by size</p>
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
                  <p className="pform__hint">Net gold weight from CAD sheet</p>
                  {form.status === 'LIVE' && !form.comingSoon && !(parseFloat(v.weightGrams) > 0) && (
                    <p className="pform__warn">⚠ 0 weight — this variant won&apos;t show a price at all on the storefront</p>
                  )}
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
                <div className="pform__field pform__span-2">
                  <label>SKU</label>
                  <input
                    value={v.sku}
                    onChange={(e) => setVariant(idx, 'sku', e.target.value)}
                    className="pform__input"
                    placeholder="AJBR-74-G18K"
                  />
                </div>
                <div className="pform__span-1">
                  {form.variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariant(idx)}
                      className="pform__variant-remove"
                      aria-label="Remove variant"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Divider + Pricing */}
              <div className="pform__pricing">
                <p className="pform__pricing-head">Pricing — used to calculate the retail price</p>
                <div className="pform__grid pform__grid--4">
                  {/* Making ₹/g */}
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
                    <p className="pform__hint">
                      Labour per gram. Typical: ₹200–400 (simple) · ₹400–700 (intricate). From
                      manufacturer.
                    </p>
                    {makingHigh && (
                      <p className="pform__warn">⚠ Unusually high — verify with manufacturer</p>
                    )}
                  </div>

                  {/* Flat making */}
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
                    <p className="pform__hint">
                      Fixed labour for engravings or complex clasps. Leave 0 if not applicable.
                    </p>
                  </div>

                  {/* Stone charges */}
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
                    <p className="pform__hint">
                      Total diamond/gem cost. Get from stone supplier. Leave 0 if no stones.
                    </p>
                    {stonesHigh && <p className="pform__warn">⚠ Above ₹5L — double-check this figure</p>}
                  </div>

                  {/* Misc */}
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
                    <p className="pform__hint">
                      BIS hallmark (₹45) + certs + packaging. Default ₹45 covers standard
                      hallmarking.
                    </p>
                  </div>
                </div>
              </div>

              {/* Live price estimate (incl. VA + diamonds at current rates) */}
              {estimated !== null && (
                <div className="pform__estimate">
                  <span className="pform__estimate-label">
                    Estimated retail price{' '}
                    <span>(current gold rate · incl. VA{stoneInputs.length ? ' + diamonds' : ''})</span>
                  </span>
                  <span className="pform__estimate-value">
                    ₹{estimated.toLocaleString('en-IN')}
                    {stoneInputs.length > 0 && estimatedExchange !== null && (
                      <> · with exchange ₹{estimatedExchange.toLocaleString('en-IN')}</>
                    )}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </section>

      {error && <p className="pform__error">{error}</p>}

      <div className="pform__actions">
        <button type="submit" disabled={saving} className="pform__submit">
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
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
