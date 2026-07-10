'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderStatus } from '@prisma/client'
import { ADMIN_TRANSITIONS, ORDER_STATUS_META } from '@/lib/orders'

type OrderActionsProps = {
  orderId: string
  status: OrderStatus
  depositAmount: number
  refundedAmount: number
  paymentCaptured: boolean
  /**
   * From lib/shipping — false while the delivery partner is undecided
   * (manual provider), which makes the SHIPPED transition show
   * courier/AWB/tracking inputs. A partner adapter with API booking will
   * replace these fields with a "Book shipment" action.
   */
  shippingSupportsBooking: boolean
}

/** Admin controls: status transitions, manual shipping details, refunds. */
export function OrderActions({
  orderId,
  status,
  depositAmount,
  refundedAmount,
  paymentCaptured,
  shippingSupportsBooking,
}: OrderActionsProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shipForm, setShipForm] = useState({ courierName: '', awbCode: '', trackingUrl: '' })
  const [showShipForm, setShowShipForm] = useState(false)

  const nextStatuses = ADMIN_TRANSITIONS[status] ?? []
  const canRefundDeposit = status === 'DELIVERED' && refundedAmount === 0 && paymentCaptured
  const canRefundFull =
    ['PAYMENT_CONFIRMED', 'PROCESSING', 'CANCELLED'].includes(status) && paymentCaptured

  async function transition(next: OrderStatus) {
    if (next === 'SHIPPED' && !shippingSupportsBooking && !showShipForm) {
      setShowShipForm(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: next,
          ...(next === 'SHIPPED' ? shipForm : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Update failed')
        return
      }
      setShowShipForm(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function refund(type: 'deposit' | 'full') {
    const label =
      type === 'deposit'
        ? `Refund the ₹${depositAmount.toLocaleString('en-IN')} security deposit?`
        : 'Issue a FULL refund for this order?'
    if (!window.confirm(label)) return

    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Refund failed')
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const btn: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: '0.75rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    border: '1px solid #032b24',
    background: '#032b24',
    color: '#fff',
    cursor: 'pointer',
  }
  const btnGhost: React.CSSProperties = { ...btn, background: '#fff', color: '#032b24' }
  const input: React.CSSProperties = {
    width: '100%',
    border: '1px solid #d1d5db',
    padding: '8px 10px',
    fontSize: '0.8125rem',
    marginBottom: 8,
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '1.25rem', marginBottom: '1rem' }}>
      <h3 style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 12 }}>
        Actions
      </h3>

      {showShipForm && (
        <div style={{ marginBottom: 12 }}>
          {/* Manual shipping entry — delivery partner not integrated yet (lib/shipping) */}
          <input
            style={input}
            placeholder="Courier name (e.g. BlueDart)"
            value={shipForm.courierName}
            onChange={(e) => setShipForm((f) => ({ ...f, courierName: e.target.value }))}
          />
          <input
            style={input}
            placeholder="AWB / tracking number"
            value={shipForm.awbCode}
            onChange={(e) => setShipForm((f) => ({ ...f, awbCode: e.target.value }))}
          />
          <input
            style={input}
            placeholder="Tracking URL (optional)"
            value={shipForm.trackingUrl}
            onChange={(e) => setShipForm((f) => ({ ...f, trackingUrl: e.target.value }))}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {nextStatuses.map((next) => (
          <button
            key={next}
            style={next === 'CANCELLED' ? btnGhost : btn}
            disabled={busy}
            onClick={() => transition(next)}
          >
            {next === 'SHIPPED' && showShipForm
              ? 'Confirm Shipment'
              : `Mark ${ORDER_STATUS_META[next].label}`}
          </button>
        ))}

        {canRefundDeposit && (
          <button style={btn} disabled={busy} onClick={() => refund('deposit')}>
            Refund 5% Deposit (₹{depositAmount.toLocaleString('en-IN')})
          </button>
        )}
        {canRefundFull && (
          <button style={btnGhost} disabled={busy} onClick={() => refund('full')}>
            Full Refund
          </button>
        )}

        {nextStatuses.length === 0 && !canRefundDeposit && !canRefundFull && (
          <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
            No actions available in this state.
          </p>
        )}
      </div>

      {error && (
        <p style={{ marginTop: 12, fontSize: '0.8125rem', color: '#b91c1c', background: '#fef2f2', padding: '8px 12px', border: '1px solid #fecaca' }}>
          {error}
        </p>
      )}
    </div>
  )
}
