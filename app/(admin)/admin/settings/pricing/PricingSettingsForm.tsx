'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type RateRow = {
  id?: string
  code: string
  label: string
  ratePerCarat: number | string
  ratePerCaratExchange: number | string
  active: boolean
}

type FormState = {
  vaGoldPct: number | string
  vaStonePct: number | string
  vaLabel: string
  showPricesGlobal: boolean
  diamondRates: RateRow[]
}

export function PricingSettingsForm({ initial }: { initial: FormState }) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function setRate(idx: number, field: keyof RateRow, value: string | boolean) {
    setForm((f) => {
      const rates = [...f.diamondRates]
      rates[idx] = { ...rates[idx], [field]: value }
      return { ...f, diamondRates: rates }
    })
  }

  function addRate() {
    setForm((f) => ({
      ...f,
      diamondRates: [
        ...f.diamondRates,
        { code: '', label: '', ratePerCarat: '', ratePerCaratExchange: '', active: true },
      ],
    }))
  }

  function removeRate(idx: number) {
    setForm((f) => ({ ...f, diamondRates: f.diamondRates.filter((_, i) => i !== idx) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    const res = await fetch('/api/admin/settings/pricing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Save failed')
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="pform">
      <section className="pform__section">
        <h2>Price Visibility</h2>
        <p className="pform__section-note">
          Storefront-wide default for whether a computed price is shown at all. Products
          without a finalized diamond/gold cost show &ldquo;Price on Request&rdquo; with a
          WhatsApp enquiry CTA instead of a checkout price. Any individual product can override
          this default from its own edit page (always show / always hide).
        </p>
        <label className="pform__check">
          <input
            type="checkbox"
            checked={form.showPricesGlobal}
            onChange={(e) => setForm((f) => ({ ...f, showPricesGlobal: e.target.checked }))}
            data-testid="show-prices-global"
          />
          <span>Show prices storefront-wide by default</span>
        </label>
      </section>

      <section className="pform__section">
        <h2>Wastage</h2>
        <p className="pform__section-note">
          Percentage applied on gold value only (not diamonds). Shown as a separate
          &ldquo;{form.vaLabel || 'Value Addition'}&rdquo; line. GST is 3% on gold + wastage +
          making + stones. Displayed weights and carats are never changed.
        </p>
        <div className="pform__grid pform__grid--2">
          <div className="pform__field">
            <label htmlFor="ps-vagold">Wastage on gold value (%)</label>
            <input
              id="ps-vagold"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={form.vaGoldPct}
              onChange={(e) => setForm((f) => ({ ...f, vaGoldPct: e.target.value }))}
              className="pform__input"
              data-testid="va-gold-pct"
            />
          </div>
          <div className="pform__field">
            <label htmlFor="ps-valabel">Customer-facing label</label>
            <input
              id="ps-valabel"
              value={form.vaLabel}
              onChange={(e) => setForm((f) => ({ ...f, vaLabel: e.target.value }))}
              className="pform__input"
              placeholder="Value Addition"
            />
            <p className="pform__hint">Shown on the price breakup, e.g. &ldquo;Value Addition&rdquo;.</p>
          </div>
        </div>
      </section>

      <section className="pform__section">
        <div className="pform__variant-head">
          <div>
            <h2>Diamond Rates (per carat)</h2>
            <p className="pform__section-note">
              Two rates per diamond type: standard (without exchange) and with-exchange.
              Products reference these types in their diamond entries.
            </p>
          </div>
          <button type="button" onClick={addRate} className="pform__addvariant" data-testid="add-rate">
            + Add diamond type
          </button>
        </div>

        {form.diamondRates.map((r, idx) => (
          <div key={r.id ?? `new-${idx}`} className="pform__variant" data-testid="rate-row">
            <div className="pform__grid pform__grid--12">
              <div className="pform__field pform__span-3">
                <label>Label</label>
                <input
                  value={r.label}
                  onChange={(e) => setRate(idx, 'label', e.target.value)}
                  className="pform__input"
                  placeholder="e.g. Colourless Diamond"
                />
              </div>
              <div className="pform__field pform__span-2">
                <label>Code</label>
                <input
                  value={r.code}
                  onChange={(e) => setRate(idx, 'code', e.target.value)}
                  className="pform__input"
                  placeholder="COLORLESS"
                />
              </div>
              <div className="pform__field pform__span-3">
                <label>₹/ct without exchange</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={r.ratePerCarat}
                  onChange={(e) => setRate(idx, 'ratePerCarat', e.target.value)}
                  className="pform__input"
                  placeholder="21000"
                />
              </div>
              <div className="pform__field pform__span-3">
                <label>₹/ct with exchange</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={r.ratePerCaratExchange}
                  onChange={(e) => setRate(idx, 'ratePerCaratExchange', e.target.value)}
                  className="pform__input"
                  placeholder="30000"
                />
              </div>
              <div className="pform__span-1">
                <button
                  type="button"
                  onClick={() => removeRate(idx)}
                  className="pform__variant-remove"
                  aria-label="Remove diamond type"
                >
                  ×
                </button>
              </div>
            </div>
            <label className="pform__check">
              <input
                type="checkbox"
                checked={r.active}
                onChange={(e) => setRate(idx, 'active', e.target.checked)}
              />
              <span>Active (selectable on products)</span>
            </label>
          </div>
        ))}
      </section>

      {error && <p className="pform__error">{error}</p>}
      {saved && !error && <p className="pform__hint" role="status">Saved.</p>}

      <div className="pform__actions">
        <button type="submit" disabled={saving} className="pform__submit" data-testid="save-pricing">
          {saving ? 'Saving…' : 'Save Pricing Settings'}
        </button>
      </div>
    </form>
  )
}
