'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderStatus } from '@prisma/client'
import {
  ADMIN_TRANSITIONS,
  OFFLINE_SETTLEMENT_TRANSITIONS,
  ORDER_STATUS_META,
  REASON_REQUIRED,
  REASON_REQUIRED_TARGETS,
} from '@/lib/orders'

type OrderActionsProps = {
  orderId: string
  status: OrderStatus
  depositAmount: number
  refundedAmount: number
  /** Sum of order.refunds ledger rows (lib/refunds.ts) — used for the
      "full" refund prefill (remaining = grandTotal − refundedTotal). */
  refundedTotal: number
  grandTotal: number
  paymentCaptured: boolean
  /** True when the order has no gateway payment (manual/WhatsApp sale) —
      settlement happens via UPI/bank and is marked here, not refunded via API. */
  offline: boolean
  /**
   * From lib/shipping — false while the delivery partner is undecided
   * (manual provider), which makes the SHIPPED transition show
   * courier/AWB/tracking inputs. A partner adapter with API booking will
   * replace these fields with a "Book shipment" action.
   */
  shippingSupportsBooking: boolean
}

/** True when a from→to move (or the target alone) requires a reason note. */
function needsReason(from: OrderStatus, to: OrderStatus): boolean {
  return (
    REASON_REQUIRED.some(([f, t]) => f === from && t === to) ||
    REASON_REQUIRED_TARGETS.includes(to)
  )
}

/** Admin controls: status transitions, manual shipping details, refunds. */
export function OrderActions({
  orderId,
  status,
  depositAmount,
  refundedAmount,
  refundedTotal,
  grandTotal,
  paymentCaptured,
  offline,
  shippingSupportsBooking,
}: OrderActionsProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shipForm, setShipForm] = useState({ courierName: '', awbCode: '', trackingUrl: '' })
  const [showShipForm, setShowShipForm] = useState(false)
  const [pendingTransition, setPendingTransition] = useState<OrderStatus | null>(null)
  const [reason, setReason] = useState('')
  const [showRefundForm, setShowRefundForm] = useState(false)
  const [refundKind, setRefundKind] = useState<'deposit' | 'full' | 'partial'>('full')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')

  // Offline orders get manual settlement marks; gateway orders get refund
  // API buttons instead (see OFFLINE_SETTLEMENT_TRANSITIONS in lib/orders.ts).
  const offlineExtra = offline
    ? (OFFLINE_SETTLEMENT_TRANSITIONS[status] ?? []).filter(
        (s2) => !(s2 === 'DEPOSIT_REFUNDED' && depositAmount === 0),
      )
    : []
  const nextStatuses = [...(ADMIN_TRANSITIONS[status] ?? []), ...offlineExtra]

  const remaining = grandTotal - refundedTotal
  const canRefundDeposit = status === 'DELIVERED' && refundedAmount === 0 && paymentCaptured && depositAmount > 0
  const canRefund = paymentCaptured && remaining > 0

  async function transition(next: OrderStatus) {
    if (next === 'SHIPPED' && !shippingSupportsBooking && !showShipForm) {
      setShowShipForm(true)
      return
    }
    if (needsReason(status, next) && pendingTransition !== next) {
      setPendingTransition(next)
      setReason('')
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
          note: reason.trim() || undefined,
          ...(next === 'SHIPPED' ? shipForm : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Update failed')
        return
      }
      setShowShipForm(false)
      setPendingTransition(null)
      setReason('')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function submitRefund() {
    if (!refundReason.trim()) {
      setError('A reason is required for the refund')
      return
    }
    const amount =
      refundKind === 'deposit' ? depositAmount : refundKind === 'full' ? remaining : Number(refundAmount)
    if (!window.confirm(`Issue a ${refundKind} refund of ₹${amount.toLocaleString('en-IN')}?`)) return

    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: refundKind,
          amount: refundKind === 'partial' ? Number(refundAmount) : undefined,
          reason: refundReason,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Refund failed')
        return
      }
      setShowRefundForm(false)
      setRefundAmount('')
      setRefundReason('')
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
  const textarea: React.CSSProperties = { ...input, minHeight: 64, resize: 'vertical' as const }

  const refundAmountValue =
    refundKind === 'deposit' ? depositAmount : refundKind === 'full' ? remaining : Number(refundAmount) || 0

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

      {pendingTransition && (
        <div style={{ marginBottom: 12 }}>
          {/* Reason note — required for REASON_REQUIRED / REASON_REQUIRED_TARGETS moves (lib/orders.ts) */}
          <textarea
            style={textarea}
            placeholder={`Reason for marking ${ORDER_STATUS_META[pendingTransition].label}…`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
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
              : pendingTransition === next
                ? 'Confirm'
                : `Mark ${ORDER_STATUS_META[next].label}`}
          </button>
        ))}

        {(canRefundDeposit || canRefund) && (
          <button
            style={btnGhost}
            disabled={busy}
            onClick={() => {
              setShowRefundForm((v) => !v)
              setRefundKind(canRefundDeposit ? 'deposit' : 'full')
              setRefundAmount('')
              setRefundReason('')
              setError(null)
            }}
          >
            {showRefundForm ? 'Cancel Refund' : 'Refund…'}
          </button>
        )}

        {nextStatuses.length === 0 && !canRefundDeposit && !canRefund && (
          <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
            No actions available in this state.
          </p>
        )}
      </div>

      {showRefundForm && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
          <select
            style={input}
            value={refundKind}
            onChange={(e) => setRefundKind(e.target.value as 'deposit' | 'full' | 'partial')}
          >
            {canRefundDeposit && (
              <option value="deposit">Deposit — ₹{depositAmount.toLocaleString('en-IN')}</option>
            )}
            <option value="full">Full remaining — ₹{remaining.toLocaleString('en-IN')}</option>
            <option value="partial">Partial…</option>
          </select>
          {refundKind === 'partial' ? (
            <input
              style={input}
              type="number"
              min={1}
              max={remaining}
              placeholder="Amount (₹)"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
          ) : (
            <input
              style={{ ...input, color: '#6b7280', background: '#f9fafb' }}
              disabled
              readOnly
              value={`₹${refundAmountValue.toLocaleString('en-IN')}`}
            />
          )}
          <input
            style={input}
            placeholder="Reason (required)"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
          />
          <button style={btn} disabled={busy} onClick={submitRefund}>
            Submit Refund
          </button>
        </div>
      )}

      {error && (
        <p style={{ marginTop: 12, fontSize: '0.8125rem', color: '#b91c1c', background: '#fef2f2', padding: '8px 12px', border: '1px solid #fecaca' }}>
          {error}
        </p>
      )}
    </div>
  )
}
