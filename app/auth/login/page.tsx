import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import GoogleButton from '@/components/auth/GoogleButton'
import SubmitButton from '@/components/auth/SubmitButton'
import { PageShell } from '@/components/layout/PageShell'
import { pageLayouts } from '@/lib/layout-config'

// ── Server Actions ────────────────────────────────────────────────────────

async function signIn(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = (formData.get('next') as string) || null
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    const q = next ? `&next=${encodeURIComponent(next)}` : ''
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}${q}`)
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    await prisma.user.upsert({
      where: { email: session.user.email! },
      update: {},
      create: {
        email: session.user.email!,
        name: session.user.user_metadata?.full_name ?? session.user.email!,
      },
    })
  }
  redirect(next ?? '/')
}

async function signUp(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = (formData.get('next') as string) || null
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) {
    const q = next ? `&next=${encodeURIComponent(next)}` : ''
    redirect(`/auth/login?mode=signup&error=${encodeURIComponent(error.message)}${q}`)
  }
  const q = next ? `&next=${encodeURIComponent(next)}` : ''
  redirect(`/auth/login?mode=confirm&email=${encodeURIComponent(email)}${q}`)
}

async function forgotPassword(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  const supabase = await createServerSupabaseClient()
  // Always return success to not reveal whether email exists
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/update-password`,
  })
  redirect(`/auth/login?msg=${encodeURIComponent('If that email exists, a reset link has been sent. Check your inbox.')}`)
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; msg?: string; next?: string; mode?: string; email?: string }>
}) {
  const { error, msg, next, mode = 'signin', email } = await searchParams
  const nextQ = next ? `?next=${encodeURIComponent(next)}` : ''
  const nextAmp = next ? `&next=${encodeURIComponent(next)}` : ''

  return (
    <PageShell {...pageLayouts.auth}>
    <main className="auth-screen">
      {/* Left — brand visual */}
      <div className="auth-screen__visual">
        <Link href="/">
          <img src="/images/vairis_main.jpeg" alt="VAIRIS Fine Jewellery" />
        </Link>
        <p className="auth-screen__tagline">Where heritage meets the extraordinary.</p>
      </div>

      {/* Right — form */}
      <div className="auth-screen__panel">
        <div className="auth-screen__mobile-logo">
          <Link href="/">
            <img src="/images/vairis_main.jpeg" alt="VAIRIS Fine Jewellery" />
          </Link>
        </div>

        <Link href="/" className="auth-back-link">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to store
        </Link>

        <div className="auth-card">
          {/* ── Confirm Email ── */}
          {mode === 'confirm' && (
            <div className="auth-confirm">
              <div className="auth-confirm__icon" aria-hidden>✉️</div>
              <div>
                <h2 className="auth-heading">Check your inbox</h2>
                <p className="auth-lead">We sent a confirmation link to</p>
                {email && <p className="auth-confirm__email">{email}</p>}
                <p className="auth-lead">
                  Click the link in the email to activate your account, then click below to sign in.
                </p>
              </div>
              <Link href={`/auth/login${nextQ}`} className="auth-link auth-link--gold">
                Back to Sign In
              </Link>
            </div>
          )}

          {/* Tabs */}
          {mode !== 'forgot' && mode !== 'confirm' && (
            <div className="auth-tabs">
              <Link href={`/auth/login${nextQ}`} className={mode === 'signin' ? 'auth-tab is-active' : 'auth-tab'}>
                Sign In
              </Link>
              <Link
                href={`/auth/login?mode=signup${nextAmp}`}
                className={mode === 'signup' ? 'auth-tab is-active' : 'auth-tab'}
              >
                Create Account
              </Link>
            </div>
          )}

          {mode === 'forgot' && (
            <div>
              <h2 className="auth-heading">Reset Password</h2>
              <p className="auth-lead">Enter your email and we&apos;ll send a reset link.</p>
            </div>
          )}

          {/* Messages */}
          {mode !== 'confirm' && msg && <p className="auth-msg auth-msg--success">{msg}</p>}
          {mode !== 'confirm' && error && <p className="auth-msg auth-msg--error">{error}</p>}

          {/* ── Sign In ── */}
          {mode === 'signin' && (
            <form action={signIn} className="auth-form">
              {next && <input type="hidden" name="next" value={next} />}
              <div className="auth-field">
                <label htmlFor="signin-email">Email</label>
                <input id="signin-email" name="email" type="email" required className="auth-input" placeholder="you@example.com" autoComplete="email" />
              </div>
              <div className="auth-field">
                <label htmlFor="signin-password">Password</label>
                <input id="signin-password" name="password" type="password" required minLength={6} className="auth-input" placeholder="••••••••" autoComplete="current-password" />
              </div>
              <SubmitButton label="Sign In" loadingLabel="Signing in…" variant="gold" />
              <div className="auth-form__meta">
                <Link href={`/auth/login?mode=forgot${nextAmp}`} className="auth-link">
                  Forgot password?
                </Link>
              </div>
            </form>
          )}

          {/* ── Sign Up ── */}
          {mode === 'signup' && (
            <form action={signUp} className="auth-form">
              {next && <input type="hidden" name="next" value={next} />}
              <div className="auth-field">
                <label htmlFor="signup-email">Email</label>
                <input id="signup-email" name="email" type="email" required className="auth-input" placeholder="you@example.com" autoComplete="email" />
              </div>
              <div className="auth-field">
                <label htmlFor="signup-password">Password</label>
                <input id="signup-password" name="password" type="password" required minLength={6} className="auth-input" placeholder="Min 6 characters" autoComplete="new-password" />
              </div>
              <SubmitButton label="Create Account" loadingLabel="Creating account…" variant="outline" />
            </form>
          )}

          {/* ── Forgot Password ── */}
          {mode === 'forgot' && (
            <form action={forgotPassword} className="auth-form">
              <div className="auth-field">
                <label htmlFor="forgot-email">Email</label>
                <input id="forgot-email" name="email" type="email" required className="auth-input" placeholder="you@example.com" autoComplete="email" />
              </div>
              <SubmitButton label="Send Reset Link" loadingLabel="Sending…" variant="gold" />
              <Link href="/auth/login" className="auth-link" style={{ textAlign: 'center' }}>
                ← Back to Sign In
              </Link>
            </form>
          )}

          {/* Google OAuth (sign-in and sign-up) */}
          {mode !== 'forgot' && mode !== 'confirm' && (
            <>
              <div className="auth-divider">
                <span>or</span>
              </div>
              <GoogleButton next={next} />
            </>
          )}

          <p className="auth-footnote">
            Admin?{' '}
            <a href="/auth/admin" className="auth-link auth-link--gold">
              Sign in here
            </a>
          </p>
        </div>
      </div>
    </main>
    </PageShell>
  )
}
