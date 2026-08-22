'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  blankLine,
  recomputeLine,
  totalsFromPayload,
  type InvoiceLine,
  type InvoicePayload,
  type InvoiceStoneRow,
} from '@/lib/invoice-document'
import { formatINRGrouped } from '@/lib/invoice-tax'

type Props = {
  initial: InvoicePayload
  invoiceId?: string
  number?: string
  orderId?: string | null
}

export function InvoiceComposer({ initial, invoiceId, number, orderId }: Props) {
  const [payload, setPayload] = useState<InvoicePayload>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState(invoiceId)
  const [savedNumber, setSavedNumber] = useState(number)

  const totals = useMemo(() => totalsFromPayload(payload), [payload])

  function setSeller<K extends keyof InvoicePayload['seller']>(key: K, value: string) {
    setPayload((p) => ({ ...p, seller: { ...p.seller, [key]: value } }))
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const body = { payload: { ...payload, lines: totals.lines }, orderId: orderId || undefined }
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
      setPayload(json.payload)
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
        <Link href="/admin/invoices" className="admin-btn">
          Back to list
        </Link>
        {savedNumber && (
          <span style={{ alignSelf: 'center', fontSize: '0.875rem', color: '#6b7280' }}>{savedNumber}</span>
        )}
      </div>

      <section className="inv-composer__line">
        <h3 style={{ marginTop: 0, fontSize: '0.875rem' }}>Seller</h3>
        <div className="inv-composer__grid">
          <Field label="Name" value={payload.seller.name} onChange={(v) => setSeller('name', v)} />
          <Field label="GSTIN" value={payload.seller.gstin} onChange={(v) => setSeller('gstin', v)} />
          <Field label="Email" value={payload.seller.email} onChange={(v) => setSeller('email', v)} />
          <Field label="Phone" value={payload.seller.phone} onChange={(v) => setSeller('phone', v)} />
        </div>
        <Field
          label="Address"
          value={payload.seller.address}
          onChange={(v) => setSeller('address', v)}
          area
        />
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
          <Field
            label="Billed to name"
            value={payload.billedTo.name}
            onChange={(v) => setPayload((p) => ({ ...p, billedTo: { ...p.billedTo, name: v } }))}
          />
          <Field
            label="Billed to phone"
            value={payload.billedTo.phone}
            onChange={(v) => setPayload((p) => ({ ...p, billedTo: { ...p.billedTo, phone: v } }))}
          />
        </div>
        <Field
          label="Billed to address"
          value={payload.billedTo.lines}
          onChange={(v) => setPayload((p) => ({ ...p, billedTo: { ...p.billedTo, lines: v } }))}
          area
        />
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
            label="Received"
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

      {payload.lines.map((line, i) => (
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
          onRemove={() =>
            setPayload((p) => ({ ...p, lines: p.lines.filter((_, j) => j !== i) }))
          }
        />
      ))}
      <button
        type="button"
        className="admin-btn"
        onClick={() => setPayload((p) => ({ ...p, lines: [...p.lines, blankLine()] }))}
      >
        Add line
      </button>

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
        <h3 style={{ marginTop: 0, fontSize: '0.875rem' }}>Totals</h3>
        <p>Taxable: ₹{formatINRGrouped(totals.taxable)}</p>
        {totals.intraState ? (
          <p>
            CGST 1.5% ₹{formatINRGrouped(totals.cgst)} · SGST 1.5% ₹{formatINRGrouped(totals.sgst)}
          </p>
        ) : (
          <p>IGST 3% ₹{formatINRGrouped(totals.igst)}</p>
        )}
        <p>
          Round off {totals.roundOff < 0 ? `(${formatINRGrouped(Math.abs(totals.roundOff))})` : formatINRGrouped(totals.roundOff)}
        </p>
        <p style={{ fontWeight: 600, fontSize: '1.125rem' }}>Payable ₹{formatINRGrouped(totals.grandTotal, 0)}</p>
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

  function patch(partial: Partial<InvoiceLine>) {
    onChange({ ...line, ...partial })
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
      <div className="inv-composer__grid">
        <Field label="Product name" value={line.productName} onChange={(v) => patch({ productName: v })} />
        <Field label="Item code" value={line.itemCode} onChange={(v) => patch({ itemCode: v })} />
        <Field label="SKU" value={line.sku} onChange={(v) => patch({ sku: v })} />
        <Field label="Metal" value={line.metalLabel} onChange={(v) => patch({ metalLabel: v })} />
        <Field label="HUID" value={line.huid} onChange={(v) => patch({ huid: v })} />
        <Field label="Certificates" value={line.certs} onChange={(v) => patch({ certs: v })} />
        <Field label="Qty" type="number" value={line.quantity} onChange={(v) => patch({ quantity: Number(v) })} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
          <input
            type="checkbox"
            checked={line.withExchange}
            onChange={(e) => patch({ withExchange: e.target.checked })}
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
      </div>

      <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>Diamonds</p>
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
            stones: [...line.stones, { label: 'Diamond', caratWeight: 0, ratePerCarat: 0, value: 0, exchange: line.withExchange }],
          })
        }
      >
        Add diamond
      </button>
      <p style={{ fontSize: '0.8rem', marginTop: 8 }}>
        Gold ₹{formatINRGrouped(computed.goldValue, 0)} · wastage ₹{formatINRGrouped(computed.wastage, 0)} · making ₹
        {formatINRGrouped(computed.making, 0)} · stones ₹{formatINRGrouped(computed.stoneValue, 0)} · taxable ₹
        {formatINRGrouped(computed.taxable)}
      </p>
    </section>
  )
}
