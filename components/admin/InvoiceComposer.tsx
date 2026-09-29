'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { InvoiceProductPicker } from '@/components/admin/InvoiceProductPicker'
import { InvoiceDeleteButton } from '@/components/admin/InvoiceDeleteButton'
import { clearInvoiceDraft, readInvoiceDraft, saveInvoiceDraft } from '@/lib/invoice-draft'
import {
  applyInvoiceSeller,
  lineFromCatalogueVariant,
  recomputeLine,
  applyInvoiceExchangeFlag,
  sellerDefaults,
  totalsFromPayload,
  type InvoiceCatalogueVariant,
  type InvoiceDiamondRateOption,
  type InvoiceLine,
  type InvoiceParty,
  type InvoicePayload,
  type InvoiceStoneRow,
} from '@/lib/invoice-document'
import { formatINRGrouped, INVOICE_GST_SCHEMES, normalizeInvoiceGstScheme } from '@/lib/invoice-tax'
import { splitGemValues } from '@/lib/pricing'
import type { PricingConfig } from '@/lib/pricing'

type CatalogueProps = {
  variants: InvoiceCatalogueVariant[]
  goldRates: Record<string, number>
  config: PricingConfig
  diamondRates: InvoiceDiamondRateOption[]
}

type Props = {
  initial: InvoicePayload
  invoiceId?: string
  number?: string
  orderId?: string | null
  catalogue: CatalogueProps
  /** Path to return to after creating a catalogue product. */
  returnPath: string
  addVariantId?: string | null
}

function sameParty(a: InvoiceParty, b: InvoiceParty) {
  return a.name === b.name && a.phone === b.phone && a.lines === b.lines
}

export function InvoiceComposer({
  initial,
  invoiceId,
  number,
  orderId,
  catalogue,
  returnPath,
  addVariantId,
}: Props) {
  const router = useRouter()
  const [payload, setPayload] = useState<InvoicePayload>(() => applyInvoiceSeller(initial))
  const [shipSameAsBill, setShipSameAsBill] = useState(() => sameParty(initial.billedTo, initial.shippedTo))
  const [variants, setVariants] = useState(catalogue.variants)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState(invoiceId)
  const [savedNumber, setSavedNumber] = useState(number)
  const [addingLine, setAddingLine] = useState(
    () => !initial.lines.some((l) => l.productName || l.itemCode || l.sku),
  )

  const seller = sellerDefaults()
  const totals = useMemo(() => totalsFromPayload(payload), [payload])

  function setBilled<K extends keyof InvoiceParty>(key: K, value: string) {
    setPayload((p) => {
      const billedTo = { ...p.billedTo, [key]: value }
      return { ...p, billedTo, shippedTo: shipSameAsBill ? billedTo : p.shippedTo }
    })
  }

  function toggleShipSame(checked: boolean) {
    setShipSameAsBill(checked)
    if (checked) {
      setPayload((p) => ({ ...p, shippedTo: { ...p.billedTo } }))
    }
  }

  function addOrReplaceLine(line: InvoiceLine) {
    setPayload((p) => {
      const onlyEmpty = p.lines.length === 1 && !p.lines[0].productName && !p.lines[0].itemCode && !p.lines[0].sku
      return { ...p, lines: onlyEmpty ? [line] : [...p.lines, line] }
    })
    setAddingLine(false)
  }

  useEffect(() => {
    const fromProductForm =
      Boolean(addVariantId) ||
      (typeof document !== 'undefined' && document.referrer.includes('/admin/products/new'))
    if (!fromProductForm) return

    const draft = readInvoiceDraft(returnPath)
    let nextPayload = draft ? applyInvoiceSeller(draft.payload) : applyInvoiceSeller(initial)
    const sameShip = draft?.shipSameAsBill ?? sameParty(initial.billedTo, initial.shippedTo)

    const picked = addVariantId
      ? catalogue.variants.find((v) => v.variantId === addVariantId)
      : undefined
    const alreadyOnInvoice =
      picked &&
      nextPayload.lines.some((l) => l.sku === picked.sku && l.productName === picked.productName)
    if (picked && !alreadyOnInvoice) {
      const line = lineFromCatalogueVariant(picked, catalogue.goldRates, catalogue.config)
      const onlyEmpty =
        nextPayload.lines.length === 1 &&
        !nextPayload.lines[0].productName &&
        !nextPayload.lines[0].itemCode &&
        !nextPayload.lines[0].sku
      nextPayload = { ...nextPayload, lines: onlyEmpty ? [line] : [...nextPayload.lines, line] }
      saveInvoiceDraft({ returnPath, payload: nextPayload, shipSameAsBill: sameShip })
    }

    // sessionStorage is client-only — restore after hydrate.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional draft resume
    setShipSameAsBill(sameShip)
    setPayload(nextPayload)
    setVariants(catalogue.variants)
    setAddingLine(!nextPayload.lines.some((l) => l.productName || l.itemCode || l.sku))

    if (addVariantId) {
      router.replace(returnPath)
    } else {
      clearInvoiceDraft()
    }
  }, [addVariantId, catalogue, initial, returnPath, router])

  function goCreateProduct() {
    saveInvoiceDraft({ returnPath, payload, shipSameAsBill })
    router.push(`/admin/products/new?returnTo=${encodeURIComponent(returnPath)}`)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const body = {
        payload: applyInvoiceSeller({ ...payload, lines: totals.lines }),
        orderId: orderId || undefined,
      }
      const res = await fetch(savedId ? `/api/admin/invoices/${savedId}` : '/api/admin/invoices', {
        method: savedId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Save failed')
        return
      }
      setSavedId(json.id)
      setSavedNumber(json.number)
      setPayload(applyInvoiceSeller(json.payload))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="inv-composer">
      {error && <p style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</p>}
      <div className="inv-composer__actions">
        <button type="button" className="admin-btn" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : savedId ? 'Save changes' : 'Create invoice'}
        </button>
        {savedId && (
          <Link href={`/admin/invoices/${savedId}/print`} className="admin-btn" target="_blank">
            Print / PDF
          </Link>
        )}
        {savedId && savedNumber && (
          <InvoiceDeleteButton id={savedId} number={savedNumber} redirectTo="/admin/invoices" variant="button" />
        )}
        <Link href="/admin/invoices" className="admin-btn">
          Back to list
        </Link>
        {savedNumber && (
          <span style={{ alignSelf: 'center', fontSize: '0.875rem', color: '#6b7280' }}>{savedNumber}</span>
        )}
      </div>

      <section className="inv-composer__line">
        <h3 style={{ marginTop: 0, fontSize: '0.875rem' }}>Seller</h3>
        <p className="inv-composer__seller">
          <strong>{seller.name}</strong>
          {'\n'}
          {seller.address}
          {'\n'}
          {seller.email} · {seller.phone}
          {'\n'}
          GSTIN: {seller.gstin}
        </p>
      </section>

      <section className="inv-composer__line">
        <h3 style={{ marginTop: 0, fontSize: '0.875rem' }}>Invoice</h3>
        <div className="inv-composer__grid">
          <Field
            label="Invoice date"
            type="date"
            value={payload.invoiceDate}
            onChange={(v) => setPayload((p) => ({ ...p, invoiceDate: v }))}
          />
          <Field
            label="Place of supply"
            value={payload.placeOfSupply}
            onChange={(v) => setPayload((p) => ({ ...p, placeOfSupply: v }))}
          />
        </div>
      </section>

      <section className="inv-composer__line">
        <h3 style={{ marginTop: 0, fontSize: '0.875rem' }}>Parties & payment</h3>
        <div className="inv-composer__grid">
          <Field label="Billed to name" value={payload.billedTo.name} onChange={(v) => setBilled('name', v)} />
          <Field label="Billed to phone" value={payload.billedTo.phone} onChange={(v) => setBilled('phone', v)} />
        </div>
        <Field label="Billed to address" value={payload.billedTo.lines} onChange={(v) => setBilled('lines', v)} area />
        <label className="inv-composer__check">
          <input type="checkbox" checked={shipSameAsBill} onChange={(e) => toggleShipSame(e.target.checked)} />
          Shipping details same as billing details
        </label>
        {!shipSameAsBill && (
          <>
            <div className="inv-composer__grid">
              <Field
                label="Shipped to name"
                value={payload.shippedTo.name}
                onChange={(v) => setPayload((p) => ({ ...p, shippedTo: { ...p.shippedTo, name: v } }))}
              />
              <Field
                label="Shipped to phone"
                value={payload.shippedTo.phone}
                onChange={(v) => setPayload((p) => ({ ...p, shippedTo: { ...p.shippedTo, phone: v } }))}
              />
            </div>
            <Field
              label="Shipped to address"
              value={payload.shippedTo.lines}
              onChange={(v) => setPayload((p) => ({ ...p, shippedTo: { ...p.shippedTo, lines: v } }))}
              area
            />
          </>
        )}
        <div className="inv-composer__grid">
          <Field
            label="Payment method"
            value={payload.payment.method}
            onChange={(v) => setPayload((p) => ({ ...p, payment: { ...p.payment, method: v } }))}
          />
          <Field
            label="Reference"
            value={payload.payment.reference}
            onChange={(v) => setPayload((p) => ({ ...p, payment: { ...p.payment, reference: v } }))}
          />
          <Field
            label="Received On"
            type="date"
            value={payload.payment.received}
            onChange={(v) => setPayload((p) => ({ ...p, payment: { ...p.payment, received: v } }))}
          />
          <Field
            label="Status (Paid in full / Unpaid)"
            value={payload.payment.status}
            onChange={(v) => setPayload((p) => ({ ...p, payment: { ...p.payment, status: v } }))}
          />
        </div>
      </section>

      {payload.lines.map((line, i) => {
        const empty = !line.productName && !line.itemCode && !line.sku
        if (empty) return null
        return (
          <LineEditor
            key={i}
            line={line}
            onChange={(next) =>
              setPayload((p) => {
                const lines = [...p.lines]
                lines[i] = next
                return { ...p, lines }
              })
            }
            onRemove={() => setPayload((p) => ({ ...p, lines: p.lines.filter((_, j) => j !== i) }))}
          />
        )
      })}

      {addingLine ? (
        <section className="inv-composer__line">
          <h3 style={{ marginTop: 0, fontSize: '0.875rem' }}>Add product</h3>
          <InvoiceProductPicker
            variants={variants}
            goldRates={catalogue.goldRates}
            config={catalogue.config}
            onPick={(line, variant) => {
              setVariants((vs) => (vs.some((v) => v.variantId === variant.variantId) ? vs : [...vs, variant]))
              addOrReplaceLine(line)
            }}
            onCreateNew={goCreateProduct}
          />
          <button type="button" className="admin-btn" style={{ marginTop: 8 }} onClick={() => setAddingLine(false)}>
            Cancel
          </button>
        </section>
      ) : (
        <button type="button" className="admin-btn" onClick={() => setAddingLine(true)}>
          Add product
        </button>
      )}

      <section className="inv-composer__line" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: '0.875rem' }}>Notes</h3>
        <Field
          label="Exchange & rate basis"
          value={payload.notes.exchange}
          onChange={(v) => setPayload((p) => ({ ...p, notes: { ...p.notes, exchange: v } }))}
          area
        />
        <Field
          label="Certification"
          value={payload.notes.certification}
          onChange={(v) => setPayload((p) => ({ ...p, notes: { ...p.notes, certification: v } }))}
          area
        />
        <Field
          label="Returns"
          value={payload.notes.returns}
          onChange={(v) => setPayload((p) => ({ ...p, notes: { ...p.notes, returns: v } }))}
          area
        />
      </section>

      <section className="inv-composer__line">
        <h3 style={{ marginTop: 0, fontSize: '0.875rem' }}>GST</h3>
        <div className="inv-composer__gst-schemes" role="radiogroup" aria-label="GST scheme">
          {INVOICE_GST_SCHEMES.map((opt) => {
            const selected = normalizeInvoiceGstScheme(payload.gstScheme) === opt.id
            const detail =
              opt.id === 'JEWELLERY'
                ? 'CGST 1.5% + SGST 1.5% · or IGST 3%'
                : 'CGST 0.75% + SGST 0.75% · or IGST 1.5%'
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? 'inv-composer__gst-scheme is-active' : 'inv-composer__gst-scheme'}
                onClick={() => setPayload((p) => ({ ...p, gstScheme: opt.id }))}
              >
                <span className="inv-composer__gst-scheme-title">{opt.label}</span>
                <span className="inv-composer__gst-scheme-detail">{detail}</span>
                <span className="inv-composer__gst-scheme-hsn">HSN {opt.hsnCode}</span>
              </button>
            )
          })}
        </div>
        <h3 style={{ marginTop: 16, fontSize: '0.875rem' }}>Totals</h3>
        <Field
          label="Discount (₹, after GST)"
          type="number"
          value={payload.discount ?? ''}
          onChange={(v) =>
            setPayload((p) => ({
              ...p,
              discount: v.trim() === '' ? 0 : Math.max(0, Number(v) || 0),
            }))
          }
        />
        <p>Taxable: ₹{formatINRGrouped(totals.taxable)}</p>
        {totals.intraState ? (
          <p>
            CGST {totals.cgstRateLabel} ₹{formatINRGrouped(totals.cgst)} · SGST{' '}
            {totals.cgstRateLabel} ₹{formatINRGrouped(totals.sgst)}
          </p>
        ) : (
          <p>
            IGST {totals.igstRateLabel} ₹{formatINRGrouped(totals.igst)}
          </p>
        )}
        <p>
          Round off{' '}
          {totals.roundOff < 0
            ? `(${formatINRGrouped(Math.abs(totals.roundOff))})`
            : formatINRGrouped(totals.roundOff)}
        </p>
        {totals.discount > 0 ? (
          <p>Discount ({formatINRGrouped(totals.discount)})</p>
        ) : null}
        <p style={{ fontWeight: 600, fontSize: '1.125rem' }}>
          Payable ₹{formatINRGrouped(totals.grandTotal, 0)}
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{totals.amountInWords}</p>
      </section>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  area,
  type = 'text',
}: {
  label: string
  value: string | number
  onChange: (v: string) => void
  area?: boolean
  type?: string
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label>{label}</label>
      {area ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}

function LineEditor({
  line,
  onChange,
  onRemove,
}: {
  line: InvoiceLine
  onChange: (line: InvoiceLine) => void
  onRemove: () => void
}) {
  const computed = recomputeLine(line, 'Wastage')
  const gems = splitGemValues({
    stoneValue: Number(line.stoneValue) || 0,
    diamondValue: line.diamondValue,
    otherStoneValue: line.otherStoneValue,
    stoneLines: line.stones.map((s) => ({ typeLabel: s.label, value: s.value })),
  })

  function patch(partial: Partial<InvoiceLine>) {
    // Formula drivers unlock live calc. Amount fields (goldValue/wastage/making/
    // stoneValue/miscCharges) stay locked so order-breakdown edits keep snapshot totals.
    const unlockKeys = [
      'weightGrams',
      'goldRatePerGram',
      'wastagePct',
      'makingPerGram',
      'flatMaking',
      'legacyStoneCharges',
      'leadIncentive',
      'stones',
      // withExchange is handled separately — flag + ₹/ct only; keep locked order amounts
    ]
    const unlock = Object.keys(partial).some((k) => unlockKeys.includes(k))
    onChange({
      ...line,
      ...partial,
      ...(unlock ? { lockedPricing: false } : null),
    })
  }

  function setExchangeOpted(checked: boolean) {
    onChange(applyInvoiceExchangeFlag(line, checked))
  }

  function patchStone(idx: number, partial: Partial<InvoiceStoneRow>) {
    const stones = line.stones.map((s, i) => (i === idx ? { ...s, ...partial } : s))
    patch({ stones })
  }

  return (
    <section className="inv-composer__line">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: '0.875rem' }}>{line.productName || 'Line item'}</h3>
        <button type="button" className="admin-btn" onClick={onRemove}>
          Remove
        </button>
      </div>
      {line.lockedPricing ? (
        <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#065f46' }}>
          Amounts from order price breakdown (not live rates). Edit Gold/Wastage/Making/Diamonds/Stones ₹
          to adjust; editing weight or rate unlocks live recalculation.
        </p>
      ) : null}
      <div className="inv-composer__grid">
        <Field label="Product name" value={line.productName} onChange={(v) => patch({ productName: v })} />
        <Field label="Item code" value={line.itemCode} onChange={(v) => patch({ itemCode: v })} />
        <Field label="SKU" value={line.sku} onChange={(v) => patch({ sku: v })} />
        <Field label="Metal" value={line.metalLabel} onChange={(v) => patch({ metalLabel: v })} />
        <Field label="HUID (this invoice)" value={line.huid} onChange={(v) => patch({ huid: v })} />
        <Field label="Certificates (this invoice)" value={line.certs} onChange={(v) => patch({ certs: v })} />
        <Field label="Qty" type="number" value={line.quantity} onChange={(v) => patch({ quantity: Number(v) })} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
          <input
            type="checkbox"
            checked={line.withExchange}
            onChange={(e) => setExchangeOpted(e.target.checked)}
          />
          Exchange opted
        </label>
        <Field
          label="Gold weight (g)"
          type="number"
          value={line.weightGrams}
          onChange={(v) => patch({ weightGrams: Number(v) })}
        />
        <Field
          label="Gold rate ₹/g"
          type="number"
          value={line.goldRatePerGram}
          onChange={(v) => patch({ goldRatePerGram: Number(v) })}
        />
        {line.lockedPricing ? (
          <>
            <Field
              label="Gold ₹"
              type="number"
              value={line.goldValue}
              onChange={(v) => patch({ goldValue: Number(v) })}
            />
            <Field
              label="Wastage ₹"
              type="number"
              value={line.wastage}
              onChange={(v) => patch({ wastage: Number(v) })}
            />
            <Field
              label="Making ₹"
              type="number"
              value={line.making}
              onChange={(v) => patch({ making: Number(v) })}
            />
            <Field
              label="Diamonds ₹"
              type="number"
              value={gems.diamonds}
              onChange={(v) => {
                const diamondValue = Number(v) || 0
                const otherStoneValue = gems.stones
                patch({
                  diamondValue,
                  otherStoneValue,
                  stoneValue: diamondValue + otherStoneValue,
                })
              }}
            />
            <Field
              label="Stones ₹"
              type="number"
              value={gems.stones}
              onChange={(v) => {
                const otherStoneValue = Number(v) || 0
                const diamondValue = gems.diamonds
                patch({
                  diamondValue,
                  otherStoneValue,
                  stoneValue: diamondValue + otherStoneValue,
                  legacyStoneCharges: otherStoneValue,
                })
              }}
            />
            <Field
              label="Misc / delivery ₹"
              type="number"
              value={line.miscCharges}
              onChange={(v) => patch({ miscCharges: Number(v) })}
            />
          </>
        ) : (
          <>
            <Field
              label="Wastage %"
              type="number"
              value={line.wastagePct}
              onChange={(v) => patch({ wastagePct: Number(v) })}
            />
            <Field
              label="Making ₹/g"
              type="number"
              value={line.makingPerGram}
              onChange={(v) => patch({ makingPerGram: Number(v) })}
            />
            <Field
              label="Flat making"
              type="number"
              value={line.flatMaking}
              onChange={(v) => patch({ flatMaking: Number(v) })}
            />
            <Field
              label="Lead incentive"
              type="number"
              value={line.leadIncentive}
              onChange={(v) => patch({ leadIncentive: Number(v) })}
            />
            <Field
              label="Misc / hallmark"
              type="number"
              value={line.miscCharges}
              onChange={(v) => patch({ miscCharges: Number(v) })}
            />
          </>
        )}
      </div>

      {!line.lockedPricing ? (
        <>
          <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>Diamonds (from product)</p>
          {line.stones.map((s, i) => (
            <div key={i} className="inv-composer__grid">
              <Field label="Label" value={s.label} onChange={(v) => patchStone(i, { label: v })} />
              <Field
                label="Carat"
                type="number"
                value={s.caratWeight}
                onChange={(v) => patchStone(i, { caratWeight: Number(v) })}
              />
              <Field
                label="₹/ct"
                type="number"
                value={s.ratePerCarat}
                onChange={(v) => patchStone(i, { ratePerCarat: Number(v) })}
              />
              <button
                type="button"
                className="admin-btn"
                style={{ alignSelf: 'end', marginBottom: 10 }}
                onClick={() => patch({ stones: line.stones.filter((_, j) => j !== i) })}
              >
                Remove stone
              </button>
            </div>
          ))}
          <button
            type="button"
            className="admin-btn"
            onClick={() =>
              patch({
                stones: [
                  ...line.stones,
                  { label: 'Diamond', caratWeight: 0, ratePerCarat: 0, value: 0, exchange: line.withExchange },
                ],
              })
            }
          >
            Add diamond
          </button>
        </>
      ) : line.stones.length > 0 ? (
        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 8 }}>
          Gem detail:{' '}
          {line.stones
            .map((s) => `${s.label || 'Diamond'} ${s.caratWeight} ct × ₹${s.ratePerCarat}/ct`)
            .join(' · ')}
        </p>
      ) : null}
      <p style={{ fontSize: '0.8rem', marginTop: 8 }}>
        Gold ₹{formatINRGrouped(computed.goldValue, 0)} · wastage ₹{formatINRGrouped(computed.wastage, 0)} · making ₹
        {formatINRGrouped(computed.making, 0)} · diamonds ₹{formatINRGrouped(gems.diamonds, 0)} · stones ₹
        {formatINRGrouped(gems.stones, 0)} · taxable ₹{formatINRGrouped(computed.taxable)}
      </p>
    </section>
  )
}
