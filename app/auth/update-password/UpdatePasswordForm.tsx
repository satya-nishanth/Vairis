'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function UpdatePasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [linkError, setLinkError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [verified, setVerified] = useState(false)
  // One pass only: clearing the tokens from the URL below changes searchParams.
  const linkChecked = useRef(false)

  // Reset links arrive in one of three shapes, depending on who sent them:
  //  - ?code=…            PKCE (forgot-password form, account page). The browser
  //                       client exchanges it while initialising; getSession()
  //                       waits for that. Previously this form ignored it and
  //                       always said the link was invalid (PRD-57).
  //  - #access_token=…    implicit (admin-sent links, service-role client).
  //  - ?token_hash=…      custom email template / verifyOtp.
  useEffect(() => {
    if (linkChecked.current) return
    linkChecked.current = true
    async function verifyLink() {
      const supabase = createClient()
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const token_hash = searchParams.get('token_hash')
      const code = searchParams.get('code')
      const urlError = searchParams.get('error_description') ?? hash.get('error_description')

      let failed = !!urlError
      if (!failed && token_hash && searchParams.get('type') === 'recovery') {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
        failed = !!error
      } else if (!failed && hash.get('type') === 'recovery' && hash.get('access_token') && hash.get('refresh_token')) {
        const { error } = await supabase.auth.setSession({
          access_token: hash.get('access_token')!,
          refresh_token: hash.get('refresh_token')!,
        })
        failed = !!error
      }

      let hasSession = false
      if (!failed) {
        const { data: { session } } = await supabase.auth.getSession()
        hasSession = !!session
        // Code not exchanged during init (e.g. verifier cookie missing because the
        // link was opened in a different browser) — try once, explicitly.
        if (!hasSession && code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          hasSession = !error
        }
      }

      // Drop one-time tokens from the address bar either way.
      if (code || token_hash || window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname)
      }

      if (hasSession) {
        setVerified(true)
      } else if (code || token_hash || urlError || window.location.hash) {
        setLinkError(
          'This reset link has expired, was already used, or was opened in a different browser from the one you requested it in. Please request a new link.',
        )
      } else {
        setLinkError('Open the password reset link from your email to set a new password.')
      }
      setVerifying(false)
    }
    verifyLink()
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

        {linkError && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="auth-msg auth-msg--error">{linkError}</p>
            <a href="/auth/login?mode=forgot" className="auth-link auth-link--gold" style={{ textAlign: 'center' }}>
              Request new reset link →
            </a>
          </div>
        )}

        {verified && (
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <p className="auth-msg auth-msg--error">{error}</p>}
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
