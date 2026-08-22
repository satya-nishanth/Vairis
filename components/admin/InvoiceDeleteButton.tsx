'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmDialog from '@/components/admin/ConfirmDialog'

type Props = {
  id: string
  number: string
  /** After delete, go here. List page omits this and refreshes in place. */
  redirectTo?: string
  variant?: 'button' | 'link'
}

export function InvoiceDeleteButton({ id, number, redirectTo, variant = 'link' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/invoices/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Delete failed')
        setLoading(false)
        return
      }
      setOpen(false)
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    } catch {
      setError('Delete failed')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={variant === 'button' ? 'admin-btn' : undefined}
        onClick={() => {
          setError('')
          setOpen(true)
        }}
        style={
          variant === 'link'
            ? { border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer', padding: 0, font: 'inherit' }
            : { color: '#b91c1c' }
        }
      >
        Delete
      </button>
      <ConfirmDialog
        open={open}
        title="Delete invoice?"
        message={
          error
            ? error
            : `Delete ${number}? This cannot be undone. Invoice numbers are not reused.`
        }
        confirmLabel="Delete invoice"
        loading={loading}
        onConfirm={() => void confirm()}
        onCancel={() => {
          if (!loading) setOpen(false)
        }}
      />
    </>
  )
}
