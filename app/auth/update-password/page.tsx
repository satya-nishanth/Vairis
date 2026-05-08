'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    // Exchange token_hash from URL for a session
    async function verifyToken() {
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      if (!token_hash || type !== 'recovery') {
        setError('Invalid or missing reset token. Request a new password reset link.')
        setVerifying(false)
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
      if (error) {
        setError(`Reset link expired or invalid: ${error.message}. Please request a new one.`)
      } else {
        setVerified(true)
      }
      setVerifying(false)
    }
    verifyToken()
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }

    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) { setError(error.message); return }

    // Sign out old session so user signs in fresh with new password
    await supabase.auth.signOut()
    router.push('/auth/login?msg=' + encodeURIComponent('Password updated — sign in with your new password.'))
  }

  const inputCls = 'w-full border border-white/20 bg-white/10 text-white placeholder-white/40 px-4 py-3 text-sm focus:outline-none focus:border-brand-gold focus:bg-white/20 transition-all'
  const labelCls = 'block text-xs text-white/60 mb-1.5 tracking-[0.2em] uppercase'

  return (
    <main className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center mb-6">
          <img src="/images/vairius_logo.png" alt="VAIRIS" style={{ height: '40px', width: 'auto', margin: '0 auto', opacity: 0.9 }} />
        </div>

        <div className="space-y-1">
          <h1 className="font-display text-2xl text-white">Set New Password</h1>
          <p className="text-xs text-white/40">Choose a new password for your account.</p>
        </div>

        {verifying && (
          <p className="text-xs text-white/40 animate-pulse">Verifying reset link…</p>
        )}

        {error && (
          <div className="space-y-3">
            <p className="text-xs bg-red-900/40 text-red-300 border border-red-700/40 px-3 py-2 rounded">{error}</p>
            <a href="/auth/login?mode=forgot" className="block text-center text-xs text-brand-gold hover:underline">
              Request new reset link →
            </a>
          </div>
        )}

        {verified && !error && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="Min 6 characters"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={labelCls}>Confirm Password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputCls}
                placeholder="Repeat password"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-brand-gold text-brand-dark text-sm font-semibold tracking-widest uppercase hover:bg-brand-gold/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
