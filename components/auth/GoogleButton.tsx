'use client'
import { createClient } from '@/lib/supabase'

export default function GoogleButton({
  next,
  darkMode = false,
}: {
  next?: string
  darkMode?: boolean
}) {
  const supabase = createClient()

  async function signInWithGoogle() {
    const redirectTo = next
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback?next=${encodeURIComponent(next)}`
      : `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  return (
    <button
      type="button"
      onClick={signInWithGoogle}
      className={
        darkMode
          ? 'w-full py-3.5 border border-white/20 text-white/70 text-sm hover:border-brand-gold/50 hover:text-brand-gold transition-colors tracking-wide'
          : 'w-full py-3 border border-gray-200 text-sm text-gray-600 hover:border-brand-gold hover:text-brand-gold transition-colors tracking-wide'
      }
    >
      Continue with Google
    </button>
  )
}
