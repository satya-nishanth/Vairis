'use client'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const supabase = createClient()

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
    })
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button
        onClick={signInWithGoogle}
        className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        Sign in with Google
      </button>
    </main>
  )
}
