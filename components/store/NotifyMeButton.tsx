'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function NotifyMeButton({
  productId,
  productPath,
}: {
  productId: string
  productPath: string
}) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleClick() {
    setState('loading')
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      // Not logged in — redirect to login with ?next= to come back here
      router.push(`/auth/login?next=${encodeURIComponent(productPath)}`)
      return
    }

    const res = await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    })

    if (res.ok || res.status === 409) {
      setState('done')
    } else {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="w-full py-4 bg-green-50 border border-green-200 text-green-700 text-sm text-center tracking-wide rounded-sm">
        ✓ We'll notify you when this is available
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className="w-full py-4 border-2 border-brand-gold text-brand-gold text-sm tracking-[0.2em] uppercase hover:bg-brand-gold hover:text-brand-dark transition-all disabled:opacity-50"
    >
      {state === 'loading' ? 'Saving…' : 'Notify Me When Available'}
    </button>
  )
}
