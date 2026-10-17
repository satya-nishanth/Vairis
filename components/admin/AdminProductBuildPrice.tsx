'use client'

import type { CSSProperties } from 'react'
import {
  feeLabelsFromConfig,
  type FeeLabels,
  type PricingConfig,
  type PriceBreakdown,
} from '@/lib/pricing'
import { formatINR } from '@/lib/pricing'
import {
  METAL_COLORS,
  METAL_PURITIES,
  colorMeta,
  formatMetalShort,
  purityMeta,
} from '@/lib/metal'

export type BuildPriceVariant = {
  metalType: string
  metalColor: string
  size: string
  weightGrams: string
  makingChargePerGram: string
  flatMakingCharge: string
  stoneCharges: string
  miscCharges: string
  miscLines: { label: string; amount: string }[]
  certificationCharges: string
  packagingCharges: string
  deliveryCharges: string
  stock: string
  sku: string
}

export type BuildPriceStone = {
  diamondRateId: string
  caratWeight: string
  count: string
  label: string
  useStoreRates: boolean
  ratePerCarat: string
  ratePerCaratExchange: string
}

export type DiamondRateOption = {
  id: string
  label: string
  ratePerCarat: number
  ratePerCaratExchange: number
}

type Props = {
  variants: BuildPriceVariant[]
  stones: BuildPriceStone[]
  diamondRates: DiamondRateOption[]
  storePricing: PricingConfig
  effectivePricing: PricingConfig
  vaGoldPct: string
  vaLabel: string
  totalLengthMm: string
  motifSizeMm: string
  thicknessMm: string
  stoneType: string
  stoneShape: string
  stoneDimMm: string
  gemCount: string
  caratWeight: string
  calcBreakdown: (v: BuildPriceVariant, withExchange: boolean) => PriceBreakdown | null
  onAddVariant: () => void
  onRemoveVariant: (idx: number) => void
  onSetVariant: (idx: number, field: keyof BuildPriceVariant, value: string) => void
  onSetVariantMiscLines?: (idx: number, lines: { label: string; amount: string }[]) => void
  onAddStone: () => void
  onRemoveStone: (idx: number) => void
  onSetStone: (idx: number, field: keyof BuildPriceStone, value: string | boolean) => void
  onSetVaGoldPct: (v: string) => void
  onSetVaLabel: (v: string) => void
  onSetField: (field: string, value: string) => void
  /** Optional multi-piece tabs (necklace + earrings, etc.) */
  pieces?: { key: string; id?: string; name: string }[]
  activePieceIndex?: number
  onSelectPiece?: (idx: number) => void
  onAddPiece?: () => void
  onRemovePiece?: (idx: number) => void
  onRenamePiece?: (idx: number, name: string) => void
}

function StorefrontBreakdown({
  breakdown,
  weightGrams,
  exchangeTotal,
  feeLabels,
}: {
  breakdown: PriceBreakdown
  weightGrams: number
  exchangeTotal: number | null
  feeLabels: FeeLabels
}) {
  const roundedGold = Math.round(breakdown.goldValue)
  const roundedMaking = Math.round(breakdown.making)
  const roundedVA = breakdown.goldVA > 0 ? Math.round(breakdown.goldVA) : 0
  const roundedMisc = breakdown.miscCharges > 0 ? Math.round(breakdown.miscCharges) : 0
  const roundedCert =
    breakdown.certificationCharges > 0 ? Math.round(breakdown.certificationCharges) : 0
  const roundedPack =
    breakdown.packagingCharges > 0 ? Math.round(breakdown.packagingCharges) : 0
  const roundedDel =
    breakdown.deliveryCharges > 0 ? Math.round(breakdown.deliveryCharges) : 0
  const roundedGST = Math.round(breakdown.gst)
  const roundedStones =
    breakdown.stoneLines.length > 0
      ? breakdown.stoneLines.reduce((sum, l) => sum + Math.round(l.value), 0)
      : Math.round(breakdown.stoneValue)
  const tableTotal =
    roundedGold +
    roundedStones +
    roundedMaking +
    roundedVA +
    roundedMisc +
    roundedCert +
    roundedPack +
    roundedDel +
    roundedGST

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 8,
        border: '1px solid #bbf7d0',
        background: '#f0fdf4',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
          flexWrap: 'wrap',
          padding: '12px 14px',
          borderBottom: '1px solid #bbf7d0',
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: '#166534',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Storefront price (what customers see)
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#15803d' }}>
            Same breakup as the product page
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#14532d' }}>
            {formatINR(Math.round(breakdown.total))}
          </div>
          {exchangeTotal != null && (
            <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: 2 }}>
              with exchange {formatINR(exchangeTotal)}
            </div>
          )}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <tbody>
          <tr>
            <td style={{ padding: '8px 14px', color: '#166534' }}>
              Gold value ({weightGrams.toFixed(3)} g)
            </td>
            <td style={{ padding: '8px 14px', textAlign: 'right', color: '#14532d', fontWeight: 500 }}>
              {formatINR(roundedGold)}
            </td>
          </tr>
          {breakdown.stoneLines.map((l, i) => (
            <tr key={i} style={{ borderTop: '1px solid #dcfce7' }}>
              <td style={{ padding: '8px 14px', color: '#166534' }}>
                {l.typeLabel} ({l.caratWeight.toFixed(2)} ct × ₹{l.ratePerCarat.toLocaleString('en-IN')}/ct)
              </td>
              <td style={{ padding: '8px 14px', textAlign: 'right', color: '#14532d', fontWeight: 500 }}>
                {formatINR(Math.round(l.value))}
              </td>
            </tr>
          ))}
          <tr style={{ borderTop: '1px solid #dcfce7' }}>
            <td style={{ padding: '8px 14px', color: '#166534' }}>Making charges</td>
            <td style={{ padding: '8px 14px', textAlign: 'right', color: '#14532d', fontWeight: 500 }}>
              {formatINR(roundedMaking)}
            </td>
          </tr>
          {roundedVA > 0 && (
            <tr style={{ borderTop: '1px solid #dcfce7' }}>
              <td style={{ padding: '8px 14px', color: '#166534' }}>
                {breakdown.vaLabel} ({Number(breakdown.goldValue) > 0
                  ? ((breakdown.goldVA / breakdown.goldValue) * 100).toFixed(1).replace(/\.0$/, '')
                  : '0'}
                %)
              </td>
              <td style={{ padding: '8px 14px', textAlign: 'right', color: '#14532d', fontWeight: 500 }}>
                {formatINR(roundedVA)}
              </td>
            </tr>
          )}
          {roundedCert > 0 && (
            <tr style={{ borderTop: '1px solid #dcfce7' }}>
              <td style={{ padding: '8px 14px', color: '#166534' }}>{feeLabels.certification}</td>
              <td style={{ padding: '8px 14px', textAlign: 'right', color: '#14532d', fontWeight: 500 }}>
                {formatINR(roundedCert)}
              </td>
            </tr>
          )}
          {roundedPack > 0 && (
            <tr style={{ borderTop: '1px solid #dcfce7' }}>
              <td style={{ padding: '8px 14px', color: '#166534' }}>{feeLabels.packaging}</td>
              <td style={{ padding: '8px 14px', textAlign: 'right', color: '#14532d', fontWeight: 500 }}>
                {formatINR(roundedPack)}
              </td>
            </tr>
          )}
          {roundedDel > 0 && (
            <tr style={{ borderTop: '1px solid #dcfce7' }}>
              <td style={{ padding: '8px 14px', color: '#166534' }}>{feeLabels.delivery}</td>
              <td style={{ padding: '8px 14px', textAlign: 'right', color: '#14532d', fontWeight: 500 }}>
                {formatINR(roundedDel)}
              </td>
            </tr>
          )}
          {roundedMisc > 0 && (
            <tr style={{ borderTop: '1px solid #dcfce7' }}>
              <td style={{ padding: '8px 14px', color: '#166534' }}>Misc</td>
              <td style={{ padding: '8px 14px', textAlign: 'right', color: '#14532d', fontWeight: 500 }}>
                {formatINR(roundedMisc)}
              </td>
            </tr>
          )}
          <tr style={{ borderTop: '1px solid #dcfce7' }}>
            <td style={{ padding: '8px 14px', color: '#166534' }}>GST</td>
            <td style={{ padding: '8px 14px', textAlign: 'right', color: '#14532d', fontWeight: 500 }}>
              {formatINR(roundedGST)}
            </td>
          </tr>
          <tr style={{ borderTop: '1px solid #86efac', background: '#dcfce7' }}>
            <td style={{ padding: '10px 14px', color: '#14532d', fontWeight: 700 }}>Total</td>
            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#14532d', fontWeight: 700 }}>
              {formatINR(tableTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

const sectionStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 20,
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
}

export default function AdminProductBuildPrice(props: Props) {
  const {
    variants,
    stones,
    diamondRates,
    storePricing,
    effectivePricing,
    vaGoldPct,
    vaLabel,
    calcBreakdown,
  } = props
  const feeLabels = feeLabelsFromConfig(storePricing)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="pform__section" style={sectionStyle}>
        <div
          className="pform__variant-head"
          style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
        >
          <div>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111827', margin: 0 }}>
              Build &amp; price
            </h2>
            <p className="pform__section-note" style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
              Metal, pricing, diamonds, and the storefront breakup — all in one place.
              {props.pieces && props.pieces.length > 1
                ? ' Tabs split the price breakup only — still one product for cart and orders.'
                : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {props.onAddPiece && (
              <button
                type="button"
                onClick={props.onAddPiece}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: 6,
                  background: '#fff',
                  color: '#111827',
                  border: '1px solid #d1d5db',
                  cursor: 'pointer',
                }}
              >
                + Add piece
              </button>
            )}
            <button
              type="button"
              onClick={props.onAddVariant}
              className="pform__addvariant"
              style={{
                padding: '6px 14px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: 6,
                background: '#111827',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + Add variant
            </button>
          </div>
        </div>

        {props.pieces && props.pieces.length > 0 && props.onSelectPiece && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 16,
              borderBottom: '1px solid #e5e7eb',
              overflowX: 'auto',
            }}
          >
            {props.pieces.map((piece, i) => {
              const active = (props.activePieceIndex ?? 0) === i
              return (
                <div key={piece.key} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button
                    type="button"
                    onClick={() => props.onSelectPiece?.(i)}
                    style={{
                      padding: '10px 14px',
                      fontSize: '0.875rem',
                      fontWeight: active ? 600 : 500,
                      color: active ? '#111827' : '#6b7280',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: active ? '2px solid #111827' : '2px solid transparent',
                      cursor: 'pointer',
                      marginBottom: -1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {piece.name || (i === 0 ? 'Main' : `Piece ${i + 1}`)}
                  </button>
                  {props.pieces!.length > 1 && props.onRemovePiece && (
                    <button
                      type="button"
                      onClick={() => props.onRemovePiece?.(i)}
                      aria-label={`Remove ${piece.name}`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        padding: '4px 6px',
                      }}
                      title="Remove piece"
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {props.pieces && props.pieces.length > 0 && props.onRenamePiece && (
          <div className="pform__field" style={{ marginBottom: 14, maxWidth: 320 }}>
            <label htmlFor="pf-piece-name">Piece name</label>
            <input
              id="pf-piece-name"
              className="pform__input"
              value={props.pieces[props.activePieceIndex ?? 0]?.name ?? ''}
              onChange={(e) => props.onRenamePiece?.(props.activePieceIndex ?? 0, e.target.value)}
              placeholder="e.g. Necklace / Earrings"
            />
            <p className="pform__hint">Shown on the storefront breakup for sets</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {variants.map((v, idx) => {
            const breakdown = calcBreakdown(v, false)
            const exchBreakdown = calcBreakdown(v, true)
            const makingHigh = parseFloat(v.makingChargePerGram) > 1500
            const stonesHigh = parseFloat(v.stoneCharges) > 500000
            const purity = purityMeta(v.metalType)
            const color = colorMeta(v.metalColor ?? 'YELLOW')
            const badge = color ?? purity
            const weight = parseFloat(v.weightGrams) || 0
            const showVaFields = idx === 0

            return (
              <div
                key={idx}
                className="pform__variant"
                style={{
                  background: '#fcfcfd',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: '1px solid #f3f4f6',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: badge?.badgeColor ?? '#f3f4f6',
                        color: badge?.badgeText ?? '#374151',
                        border: `1px solid ${badge?.badgeBorder ?? '#e5e7eb'}`,
                      }}
                    >
                      Variant {idx + 1}
                      {` · ${formatMetalShort(v.metalType, v.metalColor)}`}
                    </span>
                    {v.sku && (
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>
                        {v.sku}
                      </span>
                    )}
                  </div>
                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => props.onRemoveVariant(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                      }}
                    >
                      Remove ×
                    </button>
                  )}
                </div>

                <div className="pform__grid pform__grid--12">
                  <div className="pform__field pform__span-2">
                    <label>Purity</label>
                    <select
                      value={v.metalType}
                      onChange={(e) => props.onSetVariant(idx, 'metalType', e.target.value)}
                      className="pform__input"
                    >
                      {METAL_PURITIES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pform__field pform__span-2">
                    <label>Color</label>
                    <select
                      value={v.metalColor || 'YELLOW'}
                      onChange={(e) => props.onSetVariant(idx, 'metalColor', e.target.value)}
                      className="pform__input"
                    >
                      {METAL_COLORS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pform__field pform__span-2">
                    <label>Size</label>
                    <input
                      value={v.size}
                      onChange={(e) => props.onSetVariant(idx, 'size', e.target.value)}
                      className="pform__input"
                      placeholder="e.g. 12 / M"
                    />
                  </div>
                  <div className="pform__field pform__span-2">
                    <label>Weight (g)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={v.weightGrams}
                      onChange={(e) => props.onSetVariant(idx, 'weightGrams', e.target.value)}
                      className="pform__input"
                      placeholder="e.g. 5.17"
                    />
                  </div>
                  <div className="pform__field pform__span-2">
                    <label>Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={v.stock}
                      onChange={(e) => props.onSetVariant(idx, 'stock', e.target.value)}
                      className="pform__input"
                    />
                  </div>
                  <div className="pform__field pform__span-3">
                    <label>SKU</label>
                    <input
                      value={v.sku}
                      onChange={(e) => props.onSetVariant(idx, 'sku', e.target.value)}
                      className="pform__input"
                      placeholder="e.g. AJBN01000CH-G14K-YG"
                    />
                  </div>
                </div>

                <div className="pform__pricing" style={{ marginTop: 12, paddingTop: 10 }}>
                  <p
                    className="pform__pricing-head"
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: '#4b5563',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Pricing breakdown
                  </p>
                  <div className="pform__grid pform__grid--4">
                    <div className="pform__field">
                      <label>Making ₹/g</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={v.makingChargePerGram}
                        onChange={(e) => props.onSetVariant(idx, 'makingChargePerGram', e.target.value)}
                        className={makingHigh ? 'pform__input pform__input--warn' : 'pform__input'}
                        placeholder="e.g. 750"
                      />
                      <p className="pform__hint">Labour per gram</p>
                    </div>
                    <div className="pform__field">
                      <label>Flat Making (₹)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={v.flatMakingCharge}
                        onChange={(e) => props.onSetVariant(idx, 'flatMakingCharge', e.target.value)}
                        className="pform__input"
                        placeholder="e.g. 0"
                      />
                      <p className="pform__hint">Fixed clasp/engraving</p>
                    </div>
                    {showVaFields ? (
                      <>
                        <div className="pform__field">
                          <label htmlFor="pf-vagold">Value Addition %</label>
                          <input
                            id="pf-vagold"
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={vaGoldPct}
                            onChange={(e) => props.onSetVaGoldPct(e.target.value)}
                            className="pform__input"
                            placeholder="e.g. 10"
                            data-testid="product-va-gold-pct"
                          />
                          <p className="pform__hint">On gold only · store default {storePricing.vaGoldPct}%</p>
                        </div>
                        <div className="pform__field">
                          <label htmlFor="pf-valabel">Value Addition label</label>
                          <input
                            id="pf-valabel"
                            value={vaLabel}
                            onChange={(e) => props.onSetVaLabel(e.target.value)}
                            className="pform__input"
                            placeholder="e.g. Value Addition"
                            data-testid="product-va-label"
                          />
                          <p className="pform__hint">Shown on storefront breakup</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="pform__field">
                          <label>Value Addition %</label>
                          <input className="pform__input" value={`${effectivePricing.vaGoldPct}`} disabled />
                          <p className="pform__hint">Same for all variants</p>
                        </div>
                        <div className="pform__field">
                          <label>Value Addition label</label>
                          <input className="pform__input" value={effectivePricing.vaLabel} disabled />
                        </div>
                      </>
                    )}
                    <div className="pform__field">
                      <label>Stone Charges (₹)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={v.stoneCharges}
                        onChange={(e) => props.onSetVariant(idx, 'stoneCharges', e.target.value)}
                        className={stonesHigh ? 'pform__input pform__input--warn' : 'pform__input'}
                        placeholder="e.g. 0"
                      />
                      <p className="pform__hint">Legacy flat gem cost</p>
                    </div>
                    <div className="pform__field">
                      <label>{feeLabels.certification} (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={v.certificationCharges}
                        onChange={(e) =>
                          props.onSetVariant(idx, 'certificationCharges', e.target.value)
                        }
                        className="pform__input"
                        placeholder={String(storePricing.defaultCertificationCharges ?? 0)}
                      />
                      <p className="pform__hint">
                        Blank = store default (₹{storePricing.defaultCertificationCharges ?? 0})
                      </p>
                    </div>
                    <div className="pform__field">
                      <label>{feeLabels.packaging} (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={v.packagingCharges}
                        onChange={(e) =>
                          props.onSetVariant(idx, 'packagingCharges', e.target.value)
                        }
                        className="pform__input"
                        placeholder={String(storePricing.defaultPackagingCharges ?? 0)}
                      />
                      <p className="pform__hint">
                        Blank = store default (₹{storePricing.defaultPackagingCharges ?? 0})
                      </p>
                    </div>
                    <div className="pform__field">
                      <label>{feeLabels.delivery} (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={v.deliveryCharges}
                        onChange={(e) =>
                          props.onSetVariant(idx, 'deliveryCharges', e.target.value)
                        }
                        className="pform__input"
                        placeholder={String(storePricing.defaultDeliveryCharges ?? 0)}
                      />
                      <p className="pform__hint">
                        Blank = store default (₹{storePricing.defaultDeliveryCharges ?? 0})
                      </p>
                    </div>
                    <div className="pform__field" style={{ gridColumn: '1 / -1' }}>
                      <label>Misc (text + amount, optional)</label>
                      {(v.miscLines?.length ? v.miscLines : []).map((row, ri) => {
                        const rows = v.miscLines?.length ? v.miscLines : []
                        return (
                          <div
                            key={ri}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 120px auto',
                              gap: 8,
                              marginTop: 6,
                            }}
                          >
                            <input
                              className="pform__input"
                              value={row.label}
                              placeholder={`Text ${ri + 1}`}
                              onChange={(e) => {
                                const next = rows.map((r, j) =>
                                  j === ri ? { ...r, label: e.target.value } : r,
                                )
                                props.onSetVariantMiscLines?.(idx, next)
                              }}
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="pform__input"
                              value={row.amount}
                              placeholder={`Amount ${ri + 1}`}
                              onChange={(e) => {
                                const next = rows.map((r, j) =>
                                  j === ri ? { ...r, amount: e.target.value } : r,
                                )
                                props.onSetVariantMiscLines?.(idx, next)
                              }}
                            />
                            <button
                              type="button"
                              className="admin-btn"
                              onClick={() =>
                                props.onSetVariantMiscLines?.(
                                  idx,
                                  rows.filter((_, j) => j !== ri),
                                )
                              }
                            >
                              ×
                            </button>
                          </div>
                        )
                      })}
                      <button
                        type="button"
                        className="admin-btn"
                        style={{ marginTop: 8 }}
                        onClick={() => {
                          const rows = v.miscLines?.length ? v.miscLines : []
                          props.onSetVariantMiscLines?.(idx, [
                            ...rows,
                            { label: '', amount: '0' },
                          ])
                        }}
                      >
                        Add misc line
                      </button>
                      <p className="pform__hint">Shown with labels on the tax invoice</p>
                    </div>
                  </div>
                  <p
                    style={{
                      margin: '10px 0 0',
                      padding: '8px 10px',
                      fontSize: '0.6875rem',
                      color: '#6b7280',
                      background: '#f9fafb',
                      borderRadius: 4,
                      fontFamily: 'ui-monospace, monospace',
                    }}
                  >
                    Taxable = gold + {effectivePricing.vaLabel} ({effectivePricing.vaGoldPct}%) + making +
                    diamonds + {feeLabels.certification} + {feeLabels.packaging} + {feeLabels.delivery} +
                    misc · then GST 3%
                  </p>
                </div>

                {breakdown && weight > 0 && (
                  <StorefrontBreakdown
                    breakdown={breakdown}
                    weightGrams={weight}
                    exchangeTotal={exchBreakdown ? Math.round(exchBreakdown.total) : null}
                    feeLabels={feeLabels}
                  />
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Specs — same scroll */}
      <section className="pform__section" style={sectionStyle}>
        <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111827', margin: '0 0 12px 0' }}>
          Design specifications
        </h2>
        <div className="pform__grid pform__grid--3">
          <div className="pform__field">
            <label>Total Length (mm)</label>
            <input
              type="number"
              step="0.01"
              value={props.totalLengthMm}
              onChange={(e) => props.onSetField('totalLengthMm', e.target.value)}
              className="pform__input"
              placeholder="e.g. 152.4 (6 inch)"
            />
          </div>
          <div className="pform__field">
            <label>Motif Size (mm)</label>
            <input
              type="number"
              step="0.01"
              value={props.motifSizeMm}
              onChange={(e) => props.onSetField('motifSizeMm', e.target.value)}
              className="pform__input"
              placeholder="e.g. 9"
            />
          </div>
          <div className="pform__field">
            <label>Thickness/Depth (mm)</label>
            <input
              type="number"
              step="0.01"
              value={props.thicknessMm}
              onChange={(e) => props.onSetField('thicknessMm', e.target.value)}
              className="pform__input"
              placeholder="e.g. 2.7"
            />
          </div>
        </div>
      </section>

      <section className="pform__section" style={sectionStyle}>
        <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111827', margin: '0 0 12px 0' }}>
          Gemstone details
        </h2>
        <p className="pform__hint" style={{ marginTop: 0, marginBottom: 12 }}>
          Display-only catalogue fields — pricing uses the Diamonds rows below.
        </p>
        <div className="pform__grid pform__grid--12">
          <div className="pform__field pform__span-3">
            <label>Stone Type</label>
            <input
              value={props.stoneType}
              onChange={(e) => props.onSetField('stoneType', e.target.value)}
              className="pform__input"
              placeholder="e.g. Diamond"
            />
          </div>
          <div className="pform__field pform__span-2">
            <label>Stone Shape</label>
            <input
              value={props.stoneShape}
              onChange={(e) => props.onSetField('stoneShape', e.target.value)}
              className="pform__input"
              placeholder="e.g. Round"
            />
          </div>
          <div className="pform__field pform__span-3">
            <label>Stone Dimensions (mm)</label>
            <input
              value={props.stoneDimMm}
              onChange={(e) => props.onSetField('stoneDimMm', e.target.value)}
              className="pform__input"
              placeholder="e.g. 4.80 × 4.80"
            />
          </div>
          <div className="pform__field pform__span-2">
            <label>Gem Count</label>
            <input
              type="number"
              value={props.gemCount}
              onChange={(e) => props.onSetField('gemCount', e.target.value)}
              className="pform__input"
              placeholder="e.g. 5"
            />
          </div>
          <div className="pform__field pform__span-2">
            <label>Total Carat Weight (ctw)</label>
            <input
              type="number"
              step="0.01"
              value={props.caratWeight}
              onChange={(e) => props.onSetField('caratWeight', e.target.value)}
              className="pform__input"
              placeholder="e.g. 2.00"
            />
          </div>
        </div>
      </section>

      {/* Diamonds — same scroll as variants */}
      <section className="pform__section" style={sectionStyle}>
        <div
          className="pform__variant-head"
          style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
        >
          <div>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111827', margin: 0 }}>
              Diamonds (priced per carat)
            </h2>
            <p className="pform__section-note" style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
              Use store rates by default, or set custom ₹/ct for this product. Multiple types allowed.
            </p>
          </div>
          <button
            type="button"
            onClick={props.onAddStone}
            data-testid="add-stone"
            style={{
              padding: '6px 14px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: 6,
              background: '#111827',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            + Add diamond
          </button>
        </div>

        {diamondRates.length === 0 && (
          <p className="pform__warn">No diamond rates configured — add types at Settings → Pricing first.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {stones.map((s, idx) => {
            const rate = diamondRates.find((r) => r.id === s.diamondRateId)
            const carat = parseFloat(s.caratWeight) || 0
            const std = s.useStoreRates
              ? rate?.ratePerCarat ?? 0
              : parseFloat(s.ratePerCarat) || rate?.ratePerCarat || 0
            const exch = s.useStoreRates
              ? rate?.ratePerCaratExchange ?? 0
              : parseFloat(s.ratePerCaratExchange) || rate?.ratePerCaratExchange || 0

            return (
              <div
                key={idx}
                data-testid="stone-row"
                style={{
                  background: '#fcfcfd',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <div className="pform__grid pform__grid--12">
                  <div className="pform__field pform__span-3">
                    <label>Diamond Type</label>
                    <select
                      value={s.diamondRateId}
                      onChange={(e) => props.onSetStone(idx, 'diamondRateId', e.target.value)}
                      className="pform__input"
                    >
                      {diamondRates.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pform__field pform__span-2">
                    <label>Carat (ct)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={s.caratWeight}
                      onChange={(e) => props.onSetStone(idx, 'caratWeight', e.target.value)}
                      className="pform__input"
                      placeholder="e.g. 2.54"
                    />
                  </div>
                  <div className="pform__field pform__span-2">
                    <label>Count</label>
                    <input
                      type="number"
                      min="0"
                      value={s.count}
                      onChange={(e) => props.onSetStone(idx, 'count', e.target.value)}
                      className="pform__input"
                    />
                  </div>
                  <div className="pform__field pform__span-4">
                    <label>Label</label>
                    <input
                      value={s.label}
                      onChange={(e) => props.onSetStone(idx, 'label', e.target.value)}
                      className="pform__input"
                      placeholder="e.g. Round Brilliant"
                    />
                  </div>
                  <div className="pform__span-1" style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => props.onRemoveStone(idx)}
                      aria-label="Remove diamond"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: 600,
                        paddingBottom: 8,
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    padding: '10px 12px',
                    borderRadius: 6,
                    background: s.useStoreRates ? '#f9fafb' : '#fffbeb',
                    border: `1px solid ${s.useStoreRates ? '#e5e7eb' : '#fde68a'}`,
                  }}
                >
                  <label
                    className="pform__check"
                    style={{ fontSize: '0.8125rem', marginBottom: s.useStoreRates ? 0 : 10, display: 'flex' }}
                  >
                    <input
                      type="checkbox"
                      checked={s.useStoreRates}
                      onChange={(e) => props.onSetStone(idx, 'useStoreRates', e.target.checked)}
                    />
                    <span>
                      Use store rates
                      {rate
                        ? ` (₹${rate.ratePerCarat.toLocaleString('en-IN')}/ct · exch ₹${rate.ratePerCaratExchange.toLocaleString('en-IN')}/ct)`
                        : ''}
                    </span>
                  </label>
                  {!s.useStoreRates && (
                    <div className="pform__grid pform__grid--2" style={{ marginTop: 8 }}>
                      <div className="pform__field">
                        <label>Without exchange ₹/ct</label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={s.ratePerCarat}
                          onChange={(e) => props.onSetStone(idx, 'ratePerCarat', e.target.value)}
                          className="pform__input"
                        />
                      </div>
                      <div className="pform__field">
                        <label>With exchange ₹/ct</label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={s.ratePerCaratExchange}
                          onChange={(e) => props.onSetStone(idx, 'ratePerCaratExchange', e.target.value)}
                          className="pform__input"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {carat > 0 && std > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '6px 10px',
                      background: '#eff6ff',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      color: '#1e40af',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Stone value</span>
                    <span style={{ fontWeight: 600 }}>
                      {formatINR(Math.round(carat * std))} · exch {formatINR(Math.round(carat * exch))}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
