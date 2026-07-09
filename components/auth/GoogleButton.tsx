'use client'
import { createClient } from '@/lib/supabase'

export default function GoogleButton({ next }: { next?: string }) {
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
    <button type="button" onClick={signInWithGoogle} className="auth-btn auth-btn--ghost">
      Continue with Google
    </button>
  )
}
