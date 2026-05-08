'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Props = {
  productId: string
  productPath: string
  label?: string
  savedLabel?: string
}

export default function NotifyMeButton({
  productId,
  productPath,
  label = 'Notify Me When Available',
  savedLabel = "✓ We'll notify you when this is available",
}: Props) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  // Check on mount if already wishlisted
  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/wishlist')
      if (!res.ok) return
      const items: { productId: string }[] = await res.json()
      if (items.some((i) => i.productId === productId)) setState('done')
    }
    check()
  }, [productId])

  async function handleClick() {
    setState('loading')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.push(`/auth/login?next=${encodeURIComponent(productPath)}`)
      return
    }

    const res = await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    })

    setState(res.ok || res.status === 409 ? 'done' : 'error')
  }

  if (state === 'done') {
    return (
      <div className="space-y-2">
        <div
          data-testid="notify-success"
          className="w-full py-3 bg-green-50 border border-green-200 text-green-700 text-sm text-center tracking-wide rounded-sm"
        >
          {savedLabel}
        </div>
        <a href="/wishlist" className="block text-center text-xs text-brand-gold hover:underline">
          View your wishlist →
        </a>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      data-testid="notify-me-button"
      className="w-full py-3 border border-gray-300 text-gray-600 text-sm tracking-[0.15em] uppercase hover:border-brand-gold hover:text-brand-gold transition-all disabled:opacity-50"
    >
      {state === 'loading' ? 'Saving…' : label}
    </button>
  )
}
