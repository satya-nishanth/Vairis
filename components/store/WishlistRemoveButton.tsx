'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function WishlistRemoveButton({ productId }: { productId: string }) {
  const router = useRouter()
  const [removing, setRemoving] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    await fetch(`/api/wishlist?productId=${productId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <button
      onClick={handleRemove}
      disabled={removing}
      data-testid="wishlist-remove"
      className="mt-2 text-xs text-gray-400 hover:text-red-400 transition-colors disabled:opacity-40"
    >
      {removing ? 'Removing…' : '✕ Remove'}
    </button>
  )
}
