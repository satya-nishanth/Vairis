'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { shortFinanceId } from '@/lib/finance'

type OrderHit = {
  id: string
  contactName: string
  contactPhone: string
  status: string
}

type OrderRef =
  | { kind: 'linked'; id: string; label: string }
  | { kind: 'unlinked'; key: string; label: string }

const GREEN = '#032b24'
const BORDER = '#e5e7eb'
const MUTED = '#6b7280'

export function InventoryMarkSoldDialog({
  itemId,
  itemLabel,
  qtyOnHand,
  open,
  onClose,
}: {
  itemId: string
  itemLabel: string
  qtyOnHand: number
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [qty, setQty] = useState(String(qtyOnHand))
  const [orderRef, setOrderRef] = useState<OrderRef | null>(null)
  const [orderQuery, setOrderQuery] = useState('')
  const [orderHits, setOrderHits] = useState<OrderHit[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setQty(String(qtyOnHand))
    setOrderRef(null)
    setOrderQuery('')
    setOrderHits([])
    setError(null)
  }, [open, qtyOnHand])

  useEffect(() => {
    if (!open) return
    const q = orderQuery.trim()
    if (q.length < 2) {
      setOrderHits([])
      return
    }
    const t = setTimeout(() => {
      void fetch(`/api/admin/inventory/order-search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data: OrderHit[]) => setOrderHits(Array.isArray(data) ? data : []))
        .catch(() => setOrderHits([]))
    }, 250)
    return () => clearTimeout(t)
  }, [orderQuery, open])

  if (!open) return null

  function addOrder(hit: OrderHit) {
    setOrderRef({ kind: 'linked', id: hit.id, label: shortFinanceId(hit.id) })
    setOrderQuery('')
    setOrderHits([])
    setError(null)
  }

  function addUnlinked(raw: string) {
    const label = raw.trim()
    if (!label) return
    setOrderRef({ kind: 'unlinked', key: `u:${label}`, label })
    setOrderQuery('')
    setOrderHits([])
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const parsedQty = Number(qty)
    if (!Number.isFinite(parsedQty) || parsedQty <= 0 || parsedQty > qtyOnHand) {
      setError(`Enter a quantity between 1 and ${qtyOnHand}`)
      return
    }
    if (!orderRef) {
      setError('Link to an order or add a text reference')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/inventory/items/${itemId}/mark-sold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qty: parsedQty,
          orderId: orderRef.kind === 'linked' ? orderRef.id : undefined,
          unlinkedOrderLabel: orderRef.kind === 'unlinked' ? orderRef.label : undefined,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Could not mark as sold')
        return
      }
      onClose()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="inv-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form className="inv-modal" onSubmit={submit}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1rem', color: GREEN }}>Mark as sold</h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: MUTED }}>{itemLabel}</p>

        <div className="inv-field" style={{ marginBottom: 12 }}>
          <label>Quantity sold</label>
          <input
            type="number"
            min={1}
            max={qtyOnHand}
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>

        <div className="inv-field" style={{ marginBottom: 8 }}>
          <label>Related order</label>
          {orderRef ? (
            <div className="inv-picker-selected">
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {orderRef.kind === 'linked' ? orderRef.label : orderRef.label}
                </div>
                {orderRef.kind === 'unlinked' && (
                  <p style={{ fontSize: '0.75rem', color: MUTED, margin: '4px 0 0' }}>Not linked to order</p>
                )}
              </div>
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                onClick={() => setOrderRef(null)}
              >
                Change
              </button>
            </div>
          ) : (
            <input
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (orderHits.length === 1) addOrder(orderHits[0]!)
                  else if (orderQuery.trim()) addUnlinked(orderQuery)
                }
              }}
              placeholder="Search order or type a reference…"
              autoComplete="off"
            />
          )}
        </div>

        {!orderRef && orderQuery.trim().length >= 1 && (
          <button
            type="button"
            onClick={() => addUnlinked(orderQuery)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              border: `1px dashed ${BORDER}`,
              borderRadius: 8,
              background: '#fafafa',
              fontSize: '0.8125rem',
              color: '#374151',
              cursor: 'pointer',
              marginBottom: 8,
            }}
          >
            Add “{orderQuery.trim()}” — <span style={{ color: MUTED }}>not linked to order</span>
          </button>
        )}

        {!orderRef && orderHits.length > 0 && (
          <div className="inv-picker" style={{ marginBottom: 12 }}>
            {orderHits.map((hit) => (
              <button key={hit.id} type="button" onClick={() => addOrder(hit)}>
                <span>
                  {hit.contactName} · {shortFinanceId(hit.id)}
                </span>
                <span style={{ color: MUTED, fontSize: '0.75rem' }}>{hit.status}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p style={{ color: '#b91c1c', fontSize: '0.8125rem', margin: '0 0 12px' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="admin-btn" disabled={saving}>
            {saving ? 'Saving…' : 'Mark sold'}
          </button>
        </div>
      </form>
    </div>
  )
}
