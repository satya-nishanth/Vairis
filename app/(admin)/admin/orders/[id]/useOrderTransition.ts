'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderStatus } from '@prisma/client'
import { transitionNeedsReason } from '@/lib/orders'

export type ShipForm = {
  courierName: string
  awbCode: string
  trackingUrl: string
}

/**
 * Shared admin order status PATCH — used by OrderJourney.
 */
export function useOrderTransition(
  orderId: string,
  status: OrderStatus,
  shippingSupportsBooking: boolean,
) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shipForm, setShipForm] = useState<ShipForm>({
    courierName: '',
    awbCode: '',
    trackingUrl: '',
  })
  const [showShipForm, setShowShipForm] = useState(false)
  const [pendingTransition, setPendingTransition] = useState<OrderStatus | null>(null)
  const [reason, setReason] = useState('')

  const resetForms = useCallback(() => {
    setShowShipForm(false)
    setPendingTransition(null)
    setReason('')
  }, [])

  const transition = useCallback(
    async (next: OrderStatus) => {
      if (next === 'SHIPPED' && !shippingSupportsBooking && !showShipForm) {
        setShowShipForm(true)
        return
      }
      if (transitionNeedsReason(status, next) && pendingTransition !== next) {
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
            ...(next === 'SHIPPED' && showShipForm ? shipForm : {}),
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Update failed')
          if (next === 'SHIPPED' && shippingSupportsBooking) setShowShipForm(true)
          return
        }
        resetForms()
        router.refresh()
      } finally {
        setBusy(false)
      }
    },
    [
      orderId,
      status,
      shippingSupportsBooking,
      showShipForm,
      pendingTransition,
      reason,
      shipForm,
      resetForms,
      router,
    ],
  )

  return {
    busy,
    error,
    setError,
    shipForm,
    setShipForm,
    showShipForm,
    setShowShipForm,
    pendingTransition,
    setPendingTransition,
    reason,
    setReason,
    transition,
    resetForms,
  }
}
