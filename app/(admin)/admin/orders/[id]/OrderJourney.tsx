'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderStatus } from '@prisma/client'
import {
  ADMIN_TRANSITIONS,
  OFFLINE_SETTLEMENT_TRANSITIONS,
  ORDER_STATUS_META,
  adminJourneyProgress,
  buildAdminJourneyNodes,
  formatDuration,
  isOnAdminJourney,
} from '@/lib/orders'
import { useOrderTransition } from './useOrderTransition'

type JourneyEvent = {
  id: string
  status: OrderStatus
  note: string | null
  createdAt: string | Date
}

type OrderJourneyProps = {
  orderId: string
  status: OrderStatus
  events: JourneyEvent[]
  offline: boolean
  shippingSupportsBooking: boolean
  createdAt: string | Date
  depositAmount: number
  refundedAmount: number
  refundedTotal: number
  grandTotal: number
  paymentCaptured: boolean
  intlReviewRequired: boolean
  intlReviewApproved: boolean
}

function formatEntered(d: Date): string {
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function FailedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M4 4L10 10M10 4L4 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function DoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 7.2L5.8 10L11 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Admin order journey — timeline + all lifecycle actions in one panel. */
export function OrderJourney({
  orderId,
  status,
  events,
  offline,
  shippingSupportsBooking,
  createdAt,
  depositAmount,
  refundedAmount,
  refundedTotal,
  grandTotal,
  paymentCaptured,
  intlReviewRequired,
  intlReviewApproved,
}: OrderJourneyProps) {
  const router = useRouter()
  const {
    busy,
    error,
    setError,
    shipForm,
    setShipForm,
    showShipForm,
    pendingTransition,
    reason,
    setReason,
    transition,
    resetForms,
  } = useOrderTransition(orderId, status, shippingSupportsBooking)

  const [approvingIntl, setApprovingIntl] = useState(false)
  const [showRefundForm, setShowRefundForm] = useState(false)
  const [refundKind, setRefundKind] = useState<'deposit' | 'full' | 'partial'>('full')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundBusy, setRefundBusy] = useState(false)

  const offlineExtra = offline
    ? (OFFLINE_SETTLEMENT_TRANSITIONS[status] ?? []).filter(
        (s2) => !(s2 === 'DEPOSIT_REFUNDED' && depositAmount === 0),
      )
    : []
  const nextStatuses = [...(ADMIN_TRANSITIONS[status] ?? []), ...offlineExtra]

  const remaining = grandTotal - refundedTotal
  const canRefundDeposit =
    status === 'DELIVERED' && refundedAmount === 0 && paymentCaptured && depositAmount > 0
  const canRefund = paymentCaptured && remaining > 0
  const actionBusy = busy || refundBusy || approvingIntl
  const refundAmountValue =
    refundKind === 'deposit' ? depositAmount : refundKind === 'full' ? remaining : Number(refundAmount) || 0

  const onJourney = isOnAdminJourney(status)
  const nodes = buildAdminJourneyNodes(events, status, createdAt)
  const journeyProgress = adminJourneyProgress(nodes)

  const enteredNodes = nodes.filter((n) => n.enteredAt != null)
  const firstEntered = enteredNodes[0]?.enteredAt ?? null
  const lastEntered = enteredNodes[enteredNodes.length - 1]?.enteredAt ?? null
  const allComplete = status === 'DELIVERED' || status === 'DEPOSIT_REFUNDED'

  let summary: string
  if (!onJourney) {
    summary = `${ORDER_STATUS_META[status].label}`
  } else if (allComplete && firstEntered && lastEntered) {
    summary = `All stages complete · Turnaround ${formatDuration(lastEntered.getTime() - firstEntered.getTime())}`
  } else if (status === 'PAYMENT_PENDING') {
    summary = 'Awaiting payment'
  } else {
    const activeIdx = nodes.findIndex((n) => n.isActive)
    const stageNum = activeIdx >= 0 ? activeIdx + 1 : nodes.length
    summary = `Stage ${stageNum} of ${nodes.length} · ${ORDER_STATUS_META[status].label}`
  }

  async function submitRefund() {
    if (!refundReason.trim()) {
      setError('A reason is required for the refund')
      return
    }
    const amount =
      refundKind === 'deposit' ? depositAmount : refundKind === 'full' ? remaining : Number(refundAmount)
    if (!window.confirm(`Issue a ${refundKind} refund of ₹${amount.toLocaleString('en-IN')}?`)) return

    setRefundBusy(true)
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
      setRefundBusy(false)
    }
  }

  async function approveInternational() {
    setApprovingIntl(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/approve-international`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Approval failed')
        return
      }
      router.refresh()
    } finally {
      setApprovingIntl(false)
    }
  }

  function renderActions() {
    if (pendingTransition) {
      return (
        <>
          <div className="order-journey__forms">
            <textarea
              className="order-journey__input order-journey__textarea"
              placeholder={`Reason for marking ${ORDER_STATUS_META[pendingTransition].label}…`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="order-journey__cta-row">
            <button
              type="button"
              className="order-journey__move"
              disabled={actionBusy}
              onClick={() => transition(pendingTransition)}
            >
              Confirm
            </button>
            <button
              type="button"
              className="order-journey__move order-journey__move--alt"
              disabled={actionBusy}
              onClick={resetForms}
            >
              Cancel
            </button>
          </div>
        </>
      )
    }

    if (showShipForm) {
      return (
        <>
          <div className="order-journey__forms">
            <input
              className="order-journey__input"
              placeholder="Courier name (e.g. BlueDart)"
              value={shipForm.courierName}
              onChange={(e) => setShipForm((f) => ({ ...f, courierName: e.target.value }))}
            />
            <input
              className="order-journey__input"
              placeholder="AWB / tracking number"
              value={shipForm.awbCode}
              onChange={(e) => setShipForm((f) => ({ ...f, awbCode: e.target.value }))}
            />
            <input
              className="order-journey__input"
              placeholder="Tracking URL (optional)"
              value={shipForm.trackingUrl}
              onChange={(e) => setShipForm((f) => ({ ...f, trackingUrl: e.target.value }))}
            />
          </div>
          <div className="order-journey__cta-row">
            <button
              type="button"
              className="order-journey__move"
              disabled={actionBusy}
              onClick={() => transition('SHIPPED')}
            >
              Confirm shipment
            </button>
            <button
              type="button"
              className="order-journey__move order-journey__move--alt"
              disabled={actionBusy}
              onClick={resetForms}
            >
              Cancel
            </button>
          </div>
        </>
      )
    }

    return (
      <>
        <div className="order-journey__cta-row">
          {nextStatuses.map((next) => (
            <button
              key={next}
              type="button"
              className={
                next === 'CANCELLED'
                  ? 'order-journey__move order-journey__move--alt'
                  : 'order-journey__move'
              }
              disabled={actionBusy}
              onClick={() => transition(next)}
            >
              {`Mark ${ORDER_STATUS_META[next].label}`}
            </button>
          ))}

          {(canRefundDeposit || canRefund) && (
            <button
              type="button"
              className="order-journey__move order-journey__move--alt"
              disabled={actionBusy}
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
        </div>

        {nextStatuses.length === 0 && !canRefundDeposit && !canRefund && (
          <p className="order-journey__no-actions">No actions available in this state.</p>
        )}
      </>
    )
  }

  return (
    <div className="order-journey">
      {intlReviewRequired && !intlReviewApproved && (
        <div className="order-journey__intl">
          <span>International address — fulfillment is blocked until reviewed.</span>
          <button
            type="button"
            className="order-journey__move order-journey__move--warn"
            disabled={approvingIntl}
            onClick={approveInternational}
          >
            Approve international order
          </button>
        </div>
      )}

      <div className="order-journey__header">
        <h3 className="order-journey__title">Order journey</h3>
        <p className="order-journey__summary">{summary}</p>
      </div>

      {!onJourney ? (
        <div className="order-journey__off">
          <p className="order-journey__off-copy">
            This order is off the standard delivery path. Use the actions below for the next
            step, or open a child delivery if this is a split parent.
          </p>
          <ul className="order-journey__off-events">
            {events.slice(-6).map((e) => (
              <li key={e.id}>
                <span className="order-journey__off-time">
                  {formatEntered(e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt))}
                </span>
                {' — '}
                <strong>{ORDER_STATUS_META[e.status].label}</strong>
                {e.note ? ` · ${e.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="order-journey__scroller">
          <ol
            className="order-journey__track"
            style={{ '--journey-progress': journeyProgress } as React.CSSProperties}
          >
            {nodes.map((node, i) => {
              const prevEntered = i > 0 ? nodes[i - 1].enteredAt : null
              const gapMs =
                node.enteredAt && prevEntered
                  ? node.enteredAt.getTime() - prevEntered.getTime()
                  : null
              const nextEntered = i < nodes.length - 1 ? nodes[i + 1].enteredAt : null
              const nextGapMs =
                node.enteredAt && nextEntered
                  ? nextEntered.getTime() - node.enteredAt.getTime()
                  : null

              const stepClass = [
                'order-journey__step',
                `is-${node.state}`,
                node.isActive ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <li key={node.id} className={stepClass}>
                  {i > 0 && (
                    <div className="order-journey__connector" aria-hidden>
                      {gapMs != null && gapMs >= 0 && (
                        <span className="order-journey__gap">{formatDuration(gapMs)}</span>
                      )}
                      <span className="order-journey__line" />
                    </div>
                  )}
                  <div className="order-journey__node-col">
                    <span className="order-journey__node" aria-hidden>
                      {node.state === 'failed' ? (
                        <FailedIcon />
                      ) : node.state === 'done' ? (
                        <DoneIcon />
                      ) : null}
                    </span>
                    <div className="order-journey__meta">
                      <div className="order-journey__label">{node.label}</div>
                      {node.enteredAt ? (
                        <div className="order-journey__entered">
                          Entered {formatEntered(node.enteredAt)}
                        </div>
                      ) : (
                        <div className="order-journey__entered is-muted">Not entered</div>
                      )}
                      {node.note ? <div className="order-journey__note">{node.note}</div> : null}
                    </div>
                  </div>
                  {nextGapMs != null && nextGapMs >= 0 && (
                    <span className="order-journey__gap order-journey__gap--mobile" aria-hidden>
                      {formatDuration(nextGapMs)}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {(nextStatuses.length > 0 || canRefundDeposit || canRefund || pendingTransition || showShipForm) && (
        <div className="order-journey__cta">
          <h4 className="order-journey__actions-title">Actions</h4>
          {renderActions()}
        </div>
      )}

      {showRefundForm && (
        <div className="order-journey__refund">
          <select
            className="order-journey__input"
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
              className="order-journey__input"
              type="number"
              min={1}
              max={remaining}
              placeholder="Amount (₹)"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
          ) : (
            <input
              className="order-journey__input order-journey__input--readonly"
              disabled
              readOnly
              value={`₹${refundAmountValue.toLocaleString('en-IN')}`}
            />
          )}
          <input
            className="order-journey__input"
            placeholder="Reason (required)"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
          />
          <button
            type="button"
            className="order-journey__move"
            disabled={actionBusy}
            onClick={submitRefund}
          >
            Submit Refund
          </button>
        </div>
      )}

      {error && <p className="order-journey__error">{error}</p>}
    </div>
  )
}
