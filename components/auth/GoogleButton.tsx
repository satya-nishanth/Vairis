'use client'
import { createClient } from '@/lib/supabase'

export default function GoogleButton({ next }: { next?: string }) {
  const supabase = createClient()

  async function signInWithGoogle() {
    const redirectTo = next
      ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}`
      : `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  return (
    <button
      type="button"
      onClick={signInWithGoogle}
      className="w-full py-3 border border-gray-200 text-sm text-gray-600 hover:border-brand-gold hover:text-brand-gold transition-colors tracking-wide"
    >
      Continue with Google
    </button>
  )
}
