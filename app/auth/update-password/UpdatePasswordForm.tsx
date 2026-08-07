'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function UpdatePasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
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

    await supabase.auth.signOut()
    router.push('/auth/login?msg=' + encodeURIComponent('Password updated — sign in with your new password.'))
  }

  return (
    <main className="auth-screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="auth-card" style={{ padding: '48px 24px' }}>
        <div style={{ textAlign: 'center' }}>
          <img
            src="/images/vairius_logo.png"
            alt="VAIRIS"
            style={{ height: 40, width: 'auto', margin: '0 auto', opacity: 0.9 }}
          />
        </div>

        <div>
          <h1 className="auth-heading">Set New Password</h1>
          <p className="auth-lead">Choose a new password for your account.</p>
        </div>

        {verifying && <p className="auth-lead">Verifying reset link…</p>}

        {error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="auth-msg auth-msg--error">{error}</p>
            <a href="/auth/login?mode=forgot" className="auth-link auth-link--gold" style={{ textAlign: 'center' }}>
              Request new reset link →
            </a>
          </div>
        )}

        {verified && !error && (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                placeholder="Min 6 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="confirm-password">Confirm Password</label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="auth-input"
                placeholder="Repeat password"
                autoComplete="new-password"
              />
            </div>
            <button type="submit" disabled={loading} className="auth-btn auth-btn--gold">
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
