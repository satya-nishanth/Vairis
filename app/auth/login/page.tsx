'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const fn =
      mode === 'signin'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })

    const { error: authError } = await fn
    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    if (mode === 'signup') {
      setError('Account created — check email to confirm, then sign in.')
      setMode('signin')
      return
    }

    router.refresh()
    router.push('/admin/dashboard')
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
    })
  }

  return (
    <main className="min-h-screen bg-brand-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="font-display text-4xl tracking-widest text-brand-dark">VAIRIS</h1>
          <p className="text-sm text-gray-400 mt-2 tracking-wide">Admin Access</p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1 tracking-widest uppercase">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
              placeholder="nish99.sn@gmail.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1 tracking-widest uppercase">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p
              className={`text-xs px-3 py-2 rounded ${
                error.includes('created')
                  ? 'bg-green-50 text-green-700 border border-green-100'
                  : 'bg-red-50 text-red-600 border border-red-100'
              }`}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-dark text-white text-sm tracking-widest uppercase hover:bg-brand-light transition-colors disabled:opacity-50"
          >
            {loading ? '…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
            className="text-xs text-gray-400 hover:text-brand-gold transition-colors"
          >
            {mode === 'signin' ? 'No account? Create one →' : '← Back to sign in'}
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-brand-cream text-xs text-gray-300">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          className="w-full py-3 border border-gray-200 text-sm text-gray-600 hover:border-brand-gold hover:text-brand-gold transition-colors tracking-wide"
        >
          Continue with Google
        </button>
      </div>
    </main>
  )
}
