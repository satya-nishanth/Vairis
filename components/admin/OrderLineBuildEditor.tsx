'use client'

import {
  METAL_COLORS,
  METAL_PURITIES,
  formatMetalShort,
} from '@/lib/metal'
import type {
  OrderItemInternalBuild,
  OrderItemInternalBuildStone,
} from '@/lib/order-internal-build'

export type DiamondRateOption = {
  id: string
  label: string
  ratePerCarat: number
}

const field: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  padding: '6px 8px',
  fontSize: '0.8125rem',
}

const lab: React.CSSProperties = {
  display: 'block',
  fontSize: '0.625rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#6b7280',
  marginBottom: 3,
}

function emptyStone(rates: DiamondRateOption[]): OrderItemInternalBuildStone {
  const first = rates[0]
  return {
    typeLabel: first?.label ?? 'Diamond',
    diamondRateId: first?.id ?? null,
    caratWeight: 0,
    count: null,
    label: null,
    ratePerCarat: first?.ratePerCarat ?? null,
  }
}

/** Single-variant metal + stones editor for admin order lines (internal only). */
export function OrderLineBuildEditor({
  build,
  diamondRates,
  onChange,
}: {
  build: OrderItemInternalBuild
  diamondRates: DiamondRateOption[]
  onChange: (next: OrderItemInternalBuild) => void
}) {
  function patch(partial: Partial<OrderItemInternalBuild>) {
    onChange({
      ...build,
      ...partial,
      source: build.source === 'catalogue' || build.source === 'inventory' ? 'manual' : build.source,
      capturedAt: new Date().toISOString(),
    })
  }

  function patchStone(idx: number, partial: Partial<OrderItemInternalBuildStone>) {
    const stones = build.stones.map((s, i) => (i === idx ? { ...s, ...partial } : s))
    patch({ stones })
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: 12,
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        width: '100%',
      }}
    >
      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 10 }}>
        Build details (internal — not visible to customer)
        {build.source !== 'manual' && (
          <span style={{ marginLeft: 6 }}>
            · from {build.source}
            {build.metalType ? ` · ${formatMetalShort(build.metalType, build.metalColor)}` : ''}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 8,
        }}
      >
        <div>
          <label style={lab}>Purity</label>
          <select
            value={build.metalType}
            onChange={(e) => patch({ metalType: e.target.value })}
            style={field}
          >
            {METAL_PURITIES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={lab}>Color</label>
          <select
            value={build.metalColor}
            onChange={(e) => patch({ metalColor: e.target.value })}
            style={field}
          >
            {METAL_COLORS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.shortLabel}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={lab}>Size</label>
          <input
            value={build.size ?? ''}
            onChange={(e) => patch({ size: e.target.value || null })}
            style={field}
            placeholder="—"
          />
        </div>
        <div>
          <label style={lab}>Weight (g)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={build.weightGrams || ''}
            onChange={(e) => patch({ weightGrams: Number(e.target.value) || 0 })}
            style={field}
          />
        </div>
        <div>
          <label style={lab}>Making ₹/g</label>
          <input
            type="number"
            min={0}
            step="1"
            value={build.makingChargePerGram ?? ''}
            onChange={(e) =>
              patch({
                makingChargePerGram:
                  e.target.value === '' ? undefined : Number(e.target.value) || 0,
              })
            }
            style={field}
          />
        </div>
        <div>
          <label style={lab}>Flat making</label>
          <input
            type="number"
            min={0}
            step="1"
            value={build.flatMakingCharge ?? ''}
            onChange={(e) =>
              patch({
                flatMakingCharge: e.target.value === '' ? undefined : Number(e.target.value) || 0,
              })
            }
            style={field}
          />
        </div>
        <div>
          <label style={lab}>Misc</label>
          <input
            type="number"
            min={0}
            step="1"
            value={build.miscCharges ?? ''}
            onChange={(e) =>
              patch({
                miscCharges: e.target.value === '' ? undefined : Number(e.target.value) || 0,
              })
            }
            style={field}
          />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <strong style={{ fontSize: '0.75rem' }}>Diamonds / stones</strong>
          <button
            type="button"
            onClick={() => patch({ stones: [...build.stones, emptyStone(diamondRates)] })}
            style={{
              border: '1px solid #d1d5db',
              background: '#fff',
              padding: '4px 8px',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            + Add stone
          </button>
        </div>
        {build.stones.length === 0 && (
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>No stones</p>
        )}
        {build.stones.map((s, idx) => (
          <div
            key={idx}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(120px, 1.4fr) 70px 70px minmax(80px, 1fr) 28px',
              gap: 6,
              alignItems: 'end',
              marginBottom: 6,
            }}
          >
            <div>
              <label style={lab}>Type</label>
              <select
                value={s.diamondRateId ?? ''}
                onChange={(e) => {
                  const id = e.target.value || null
                  const rate = diamondRates.find((r) => r.id === id)
                  patchStone(idx, {
                    diamondRateId: id,
                    typeLabel: rate?.label ?? s.typeLabel,
                    ratePerCarat: rate?.ratePerCarat ?? s.ratePerCarat,
                  })
                }}
                style={field}
              >
                <option value="">Custom</option>
                {diamondRates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              {!s.diamondRateId && (
                <input
                  value={s.typeLabel}
                  onChange={(e) => patchStone(idx, { typeLabel: e.target.value })}
                  style={{ ...field, marginTop: 4 }}
                  placeholder="Type label"
                />
              )}
            </div>
            <div>
              <label style={lab}>Ct</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={s.caratWeight || ''}
                onChange={(e) => patchStone(idx, { caratWeight: Number(e.target.value) || 0 })}
                style={field}
              />
            </div>
            <div>
              <label style={lab}>Count</label>
              <input
                type="number"
                min={0}
                step="1"
                value={s.count ?? ''}
                onChange={(e) =>
                  patchStone(idx, {
                    count: e.target.value === '' ? null : Number(e.target.value) || 0,
                  })
                }
                style={field}
              />
            </div>
            <div>
              <label style={lab}>Label</label>
              <input
                value={s.label ?? ''}
                onChange={(e) => patchStone(idx, { label: e.target.value || null })}
                style={field}
                placeholder="Optional"
              />
            </div>
            <button
              type="button"
              onClick={() => patch({ stones: build.stones.filter((_, i) => i !== idx) })}
              style={{
                border: 'none',
                background: 'none',
                color: '#b91c1c',
                cursor: 'pointer',
                paddingBottom: 6,
              }}
              aria-label="Remove stone"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Compact read-only summary for order detail. */
export function OrderLineBuildSummary({ build }: { build: OrderItemInternalBuild }) {
  return (
    <div style={{ fontSize: '0.75rem', color: '#374151', lineHeight: 1.5 }}>
      <div>
        {formatMetalShort(build.metalType, build.metalColor)}
        {build.size ? ` · Size ${build.size}` : ''} · {build.weightGrams} g
      </div>
      {build.stones.length > 0 && (
        <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
          {build.stones.map((s, i) => (
            <li key={i}>
              {s.label ? `${s.label} — ` : ''}
              {s.typeLabel}
              {s.count ? ` × ${s.count}` : ''} · {s.caratWeight.toFixed(2)} ct total
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
