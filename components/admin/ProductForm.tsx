'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ImageUploader from './ImageUploader'

const CATEGORIES = ['RINGS', 'EARRINGS', 'PENDANTS', 'BRACELETS']
const METAL_TYPES = [
  { value: 'GOLD_18K', label: '18kt Gold', skuSuffix: 'G18K' },
  { value: 'GOLD_14K', label: '14kt Gold', skuSuffix: 'G14K' },
  { value: 'ROSE_GOLD', label: 'Rose Gold 18kt', skuSuffix: 'RG' },
]

// Approximate rates for admin price preview — updated by gold rate cron
const STORED_RATES: Record<string, number> = {
  GOLD_18K: 5100,
  GOLD_14K: 3967,
  ROSE_GOLD: 5100,
}

function buildSku(itemCode: string, metalType: string): string {
  if (!itemCode) return ''
  const suffix = METAL_TYPES.find((m) => m.value === metalType)?.skuSuffix ?? metalType
  return `${itemCode.toUpperCase()}-${suffix}`
}

function calcEstimatedPrice(v: Variant): number | null {
  const weight = parseFloat(v.weightGrams)
  if (!weight || weight <= 0) return null
  const rate = STORED_RATES[v.metalType] ?? 0
  const making = weight * (parseFloat(v.makingChargePerGram) || 0) + (parseFloat(v.flatMakingCharge) || 0)
  const goldValue = weight * rate
  const stones = parseFloat(v.stoneCharges) || 0
  const misc = parseFloat(v.miscCharges) || 0
  const gst = goldValue * 0.03 + making * 0.05
  return Math.round(goldValue + making + stones + misc + gst)
}

type Variant = {
  metalType: string
  weightGrams: string
  makingChargePerGram: string
  flatMakingCharge: string
  stoneCharges: string
  miscCharges: string
  stock: string
  sku: string
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
  isActive: boolean
  comingSoon: boolean
}

type Props = {
  initialData?: Partial<FormData> & { id?: string }
  mode: 'create' | 'edit'
}

function emptyVariant(): Variant {
  return {
    metalType: 'GOLD_18K',
    weightGrams: '',
    makingChargePerGram: '',
    flatMakingCharge: '0',
    stoneCharges: '0',
    miscCharges: '45',
    stock: '0',
    sku: '',
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
    variants: data?.variants?.length ? data.variants as Variant[] : [emptyVariant()],
    isActive: data?.isActive ?? true,
    comingSoon: (data as any)?.comingSoon ?? false,
  }
}

export default function ProductForm({ initialData, mode }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(initialForm(initialData))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: keyof FormData, value: any) {
    setForm((f) => {
      const next = { ...f, [field]: value }
      if (field === 'itemCode') {
        next.variants = f.variants.map((v) => ({
          ...v,
          sku: buildSku(value as string, v.metalType),
        }))
      }
      return next
    })
  }

  function setVariant(idx: number, field: keyof Variant, value: string) {
    setForm((f) => {
      const v = [...f.variants]
      v[idx] = { ...v[idx], [field]: value }
      if (field === 'metalType' && f.itemCode) {
        const wasAuto = !v[idx].sku || v[idx].sku === buildSku(f.itemCode, v[idx].metalType)
        if (wasAuto) v[idx].sku = buildSku(f.itemCode, value)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // FE guard: making charge required unless product is Coming Soon
    if (!form.comingSoon) {
      for (const v of form.variants) {
        if (v.makingChargePerGram === '' || v.makingChargePerGram === undefined) {
          setError('Every variant must have a Making Charge (₹/g). Mark as "Coming Soon" if pricing is not set yet.')
          return
        }
        if (parseFloat(v.makingChargePerGram) < 0) {
          setError('Making Charge cannot be negative.')
          return
        }
      }
    }

    setSaving(true)
    setError('')

    const url = mode === 'create' ? '/api/admin/products' : `/api/admin/products/${initialData?.id}`
    const res = await fetch(url, {
      method: mode === 'create' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Save failed')
      return
    }

    router.push('/admin/products')
    router.refresh()
  }

  const inputCls =
    'w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1 tracking-wide uppercase'
  const hintCls = 'text-[10px] text-gray-400 mt-0.5 leading-tight'

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      {/* Basic info */}
      <section className="bg-white border border-gray-100 rounded-lg p-4 md:p-6 space-y-4">
        <h2 className="font-display text-lg text-gray-900">Basic Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Product Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className={inputCls}
              placeholder="e.g. Heart Diamond Bracelet"
            />
          </div>
          <div>
            <label className={labelCls}>Item Code</label>
            <input
              value={form.itemCode}
              onChange={(e) => set('itemCode', e.target.value)}
              className={inputCls}
              placeholder="e.g. AJBR-74"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Category *</label>
            <select
              required
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className={inputCls}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                className="w-4 h-4 accent-brand-gold"
              />
              <span className="text-sm text-gray-700">Active (visible on store)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.comingSoon}
                onChange={(e) => set('comingSoon', e.target.checked)}
                className="w-4 h-4 accent-brand-gold"
              />
              <span className="text-sm text-gray-700">Coming Soon</span>
            </label>
            {form.comingSoon && (
              <p className="text-[10px] text-amber-600 leading-tight">
                Pricing optional — shown as "Coming Soon" with a Notify Me button. No price displayed.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            className={inputCls}
            placeholder="Brief product description"
          />
        </div>

        <div>
          <label className={labelCls}>Design Style</label>
          <textarea
            value={form.designStyle}
            onChange={(e) => set('designStyle', e.target.value)}
            rows={2}
            className={inputCls}
            placeholder="e.g. Alternating open heart motifs and bezel-set round stones"
          />
        </div>
      </section>

      {/* Images */}
      <section className="bg-white border border-gray-100 rounded-lg p-4 md:p-6 space-y-3">
        <h2 className="font-display text-lg text-gray-900">Product Images</h2>
        <ImageUploader images={form.images} onChange={(imgs) => set('images', imgs)} />
      </section>

      {/* Physical specs */}
      <section className="bg-white border border-gray-100 rounded-lg p-4 md:p-6 space-y-4">
        <h2 className="font-display text-lg text-gray-900">Design Specifications</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Total Length (mm)</label>
            <input
              type="number"
              step="0.01"
              value={form.totalLengthMm}
              onChange={(e) => set('totalLengthMm', e.target.value)}
              className={inputCls}
              placeholder="e.g. 152.4 (6 inch)"
            />
          </div>
          <div>
            <label className={labelCls}>Motif Size (mm)</label>
            <input
              type="number"
              step="0.01"
              value={form.motifSizeMm}
              onChange={(e) => set('motifSizeMm', e.target.value)}
              className={inputCls}
              placeholder="e.g. 9"
            />
          </div>
          <div>
            <label className={labelCls}>Thickness/Depth (mm)</label>
            <input
              type="number"
              step="0.01"
              value={form.thicknessMm}
              onChange={(e) => set('thicknessMm', e.target.value)}
              className={inputCls}
              placeholder="e.g. 2.7"
            />
          </div>
        </div>
      </section>

      {/* Gemstone */}
      <section className="bg-white border border-gray-100 rounded-lg p-4 md:p-6 space-y-4">
        <h2 className="font-display text-lg text-gray-900">Gemstone Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Stone Type</label>
            <input
              value={form.stoneType}
              onChange={(e) => set('stoneType', e.target.value)}
              className={inputCls}
              placeholder="e.g. Diamond"
            />
          </div>
          <div>
            <label className={labelCls}>Stone Shape</label>
            <input
              value={form.stoneShape}
              onChange={(e) => set('stoneShape', e.target.value)}
              className={inputCls}
              placeholder="e.g. Round"
            />
          </div>
          <div>
            <label className={labelCls}>Stone Dimensions (mm)</label>
            <input
              value={form.stoneDimMm}
              onChange={(e) => set('stoneDimMm', e.target.value)}
              className={inputCls}
              placeholder="e.g. 4.80 x 4.80"
            />
          </div>
          <div>
            <label className={labelCls}>Gem Count</label>
            <input
              type="number"
              value={form.gemCount}
              onChange={(e) => set('gemCount', e.target.value)}
              className={inputCls}
              placeholder="e.g. 5"
            />
          </div>
          <div>
            <label className={labelCls}>Total Carat Weight (ctw)</label>
            <input
              type="number"
              step="0.01"
              value={form.caratWeight}
              onChange={(e) => set('caratWeight', e.target.value)}
              className={inputCls}
              placeholder="e.g. 2.00"
            />
          </div>
        </div>
      </section>

      {/* Variants */}
      <section className="bg-white border border-gray-100 rounded-lg p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg text-gray-900">Metal Variants &amp; Pricing</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Add one row per metal you offer. Pricing fields are used to calculate the retail price
              shown to customers.
            </p>
          </div>
          <button
            type="button"
            onClick={addVariant}
            className="text-xs text-brand-gold hover:underline shrink-0"
          >
            + Add variant
          </button>
        </div>

        <div className="space-y-4">
          {form.variants.map((v, idx) => {
            const estimated = calcEstimatedPrice(v)
            const makingHigh = parseFloat(v.makingChargePerGram) > 1500
            const stonesHigh = parseFloat(v.stoneCharges) > 500000

            return (
              <div key={idx} className="border border-gray-100 rounded-lg p-4 space-y-4">
                {/* Row 1: Identity */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                  <div className="sm:col-span-3">
                    <label className={labelCls}>Metal Type</label>
                    <select
                      value={v.metalType}
                      onChange={(e) => setVariant(idx, 'metalType', e.target.value)}
                      className={inputCls}
                    >
                      {METAL_TYPES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Weight (g)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={v.weightGrams}
                      onChange={(e) => setVariant(idx, 'weightGrams', e.target.value)}
                      className={inputCls}
                      placeholder="8.500"
                    />
                    <p className={hintCls}>Net gold weight from CAD sheet</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Stock</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      data-testid="variant-stock"
                      value={v.stock}
                      onChange={(e) => setVariant(idx, 'stock', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className={labelCls}>SKU</label>
                    <input
                      value={v.sku}
                      onChange={(e) => setVariant(idx, 'sku', e.target.value)}
                      className={inputCls}
                      placeholder="AJBR-74-G18K"
                    />
                  </div>
                  <div className="sm:col-span-1 flex items-end pb-[1px] pt-5">
                    {form.variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(idx)}
                        className="w-8 h-9 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors text-lg"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Divider + Pricing */}
                <div className="border-t border-gray-50 pt-3">
                  <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-3">
                    Pricing — used to calculate the retail price
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {/* Making ₹/g */}
                    <div>
                      <label className={labelCls}>
                        Making ₹/g{' '}
                        {!form.comingSoon && <span className="text-red-400">*</span>}
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={v.makingChargePerGram}
                        onChange={(e) => setVariant(idx, 'makingChargePerGram', e.target.value)}
                        className={`${inputCls} ${makingHigh ? 'border-amber-400' : ''}`}
                        placeholder="e.g. 400"
                      />
                      <p className={hintCls}>
                        Labour per gram. Typical: ₹200–400 (simple) · ₹400–700 (intricate). From
                        manufacturer.
                      </p>
                      {makingHigh && (
                        <p className="text-[10px] text-amber-600 mt-0.5">
                          ⚠ Unusually high — verify with manufacturer
                        </p>
                      )}
                    </div>

                    {/* Flat making */}
                    <div>
                      <label className={labelCls}>Flat Making (₹)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={v.flatMakingCharge}
                        onChange={(e) => setVariant(idx, 'flatMakingCharge', e.target.value)}
                        className={inputCls}
                        placeholder="0"
                      />
                      <p className={hintCls}>
                        Fixed labour for engravings or complex clasps. Leave 0 if not applicable.
                      </p>
                    </div>

                    {/* Stone charges */}
                    <div>
                      <label className={labelCls}>Stone Charges (₹)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={v.stoneCharges}
                        onChange={(e) => setVariant(idx, 'stoneCharges', e.target.value)}
                        className={`${inputCls} ${stonesHigh ? 'border-amber-400' : ''}`}
                        placeholder="0"
                      />
                      <p className={hintCls}>
                        Total diamond/gem cost. Get from stone supplier. Leave 0 if no stones.
                      </p>
                      {stonesHigh && (
                        <p className="text-[10px] text-amber-600 mt-0.5">
                          ⚠ Above ₹5L — double-check this figure
                        </p>
                      )}
                    </div>

                    {/* Misc */}
                    <div>
                      <label className={labelCls}>Misc (₹)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={v.miscCharges}
                        onChange={(e) => setVariant(idx, 'miscCharges', e.target.value)}
                        className={inputCls}
                        placeholder="45"
                      />
                      <p className={hintCls}>
                        BIS hallmark (₹45) + certs + packaging. Default ₹45 covers standard
                        hallmarking.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Live price estimate */}
                {estimated !== null && (
                  <div className="bg-brand-cream rounded px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Estimated retail price{' '}
                      <span className="text-gray-400">(at stored gold rate — updates with live cron)</span>
                    </span>
                    <span className="text-sm font-medium text-brand-dark">
                      ₹{estimated.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded px-4 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-8 py-3 bg-brand-dark text-white text-sm tracking-widest uppercase hover:bg-brand-light transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : mode === 'create' ? 'Create Product' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 border border-gray-200 text-sm text-gray-600 hover:border-gray-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
