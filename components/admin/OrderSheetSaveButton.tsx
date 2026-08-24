'use client'

import { useFormStatus } from 'react-dom'

export function OrderSheetSaveButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="admin-btn order-sheet-save-btn" disabled={pending}>
      {pending ? 'Saving…' : 'Save sheet'}
    </button>
  )
}
