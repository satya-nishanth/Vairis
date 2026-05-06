'use client'
import { createClient } from '@/lib/supabase'

export default function GoogleButton() {
  const supabase = createClient()

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
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
