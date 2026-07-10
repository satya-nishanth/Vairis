'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ImageUploader from './ImageUploader'

const CATEGORIES = ['RINGS', 'EARRINGS', 'PENDANTS', 'BRACELETS', 'NECKLACES']
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
    comingSoon: data?.comingSoon ?? false,
  }
}

export default function ProductForm({ initialData, mode }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(initialForm(initialData))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof FormData>(field: K, value: FormData[K]) {
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
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="pform__input"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="pform__checks">
            <label className="pform__check">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
              />
              <span>Active (visible on store)</span>
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
      </section>

      {/* Images */}
      <section className="pform__section">
        <h2>Product Images</h2>
        <ImageUploader images={form.images} onChange={(imgs) => set('images', imgs)} />
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
          const estimated = calcEstimatedPrice(v)
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
                <div className="pform__field pform__span-4">
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
                    <label>
                      Making ₹/g {!form.comingSoon && <span className="pform__required">*</span>}
                    </label>
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

              {/* Live price estimate */}
              {estimated !== null && (
                <div className="pform__estimate">
                  <span className="pform__estimate-label">
                    Estimated retail price{' '}
                    <span>(at stored gold rate — updates with live cron)</span>
                  </span>
                  <span className="pform__estimate-value">₹{estimated.toLocaleString('en-IN')}</span>
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
        <button type="button" onClick={() => router.back()} className="pform__cancel">
          Cancel
        </button>
      </div>
    </form>
  )
}
