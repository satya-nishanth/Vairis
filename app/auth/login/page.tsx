import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import GoogleButton from '@/components/auth/GoogleButton'
import SubmitButton from '@/components/auth/SubmitButton'

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

  const inputCls =
    'w-full border border-white/20 bg-white/10 text-white placeholder-white/40 px-4 py-3 text-sm focus:outline-none focus:border-brand-gold focus:bg-white/20 transition-all'
  const labelCls = 'block text-xs text-white/60 mb-1.5 tracking-[0.2em] uppercase'
  const tabBase = 'text-xs tracking-[0.2em] uppercase pb-2 border-b-2 transition-colors'
  const tabActive = `${tabBase} text-white border-brand-gold`
  const tabInactive = `${tabBase} text-white/40 border-transparent hover:text-white/70`

  return (
    <main className="min-h-screen bg-brand-dark flex">
      {/* Left — brand visual */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center px-16 relative">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 40%, #c9a84c 0%, transparent 55%), radial-gradient(circle at 70% 70%, #c9a84c 0%, transparent 40%)`,
          }}
        />
        <div className="relative text-center space-y-6">
          <Link href="/">
            <img
              src="/images/vairis_main.jpeg"
              alt="VAIRIS Fine Jewellery"
              style={{ width: 'min(280px, 40vw)', height: 'auto', borderRadius: '4px' }}
              className="drop-shadow-[0_8px_40px_rgba(201,168,76,0.25)]"
            />
          </Link>
          <p className="font-display text-white/70 italic" style={{ fontSize: '18px', fontWeight: 300 }}>
            Where heritage meets the extraordinary.
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-8 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden text-center mb-8">
          <Link href="/">
            <img src="/images/vairis_main.jpeg" alt="VAIRIS Fine Jewellery"
              style={{ height: '100px', width: 'auto', margin: '0 auto', borderRadius: '4px' }} />
          </Link>
        </div>

        <Link href="/" className="self-start mb-2 flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to store
        </Link>
        <div className="w-full max-w-sm space-y-6">

          {/* ── Confirm Email ── */}
          {mode === 'confirm' && (
            <div className="text-center space-y-5 py-4">
              <div className="text-4xl">✉️</div>
              <div className="space-y-2">
                <h2 className="font-display text-2xl text-white" style={{ fontWeight: 400 }}>Check your inbox</h2>
                <p className="text-sm text-white/60">
                  We sent a confirmation link to
                </p>
                {email && (
                  <p className="text-sm text-brand-gold font-medium">{email}</p>
                )}
                <p className="text-xs text-white/40 pt-1">
                  Click the link in the email to activate your account, then click below to sign in.
                </p>
              </div>
              <Link
                href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
                className="inline-block text-xs text-white/40 hover:text-brand-gold transition-colors border-b border-white/20 pb-0.5"
              >
                Back to Sign In
              </Link>
            </div>
          )}

          {/* Tabs */}
          {mode !== 'forgot' && mode !== 'confirm' && (
            <div className="flex items-center gap-6">
              <Link href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className={mode === 'signin' ? tabActive : tabInactive}>
                Sign In
              </Link>
              <Link href={`/auth/login?mode=signup${next ? `&next=${encodeURIComponent(next)}` : ''}`} className={mode === 'signup' ? tabActive : tabInactive}>
                Create Account
              </Link>
            </div>
          )}

          {mode === 'forgot' && (
            <div className="space-y-1">
              <h2 className="font-display text-xl text-white">Reset Password</h2>
              <p className="text-xs text-white/40">Enter your email and we'll send a reset link.</p>
            </div>
          )}

          {/* Messages */}
          {mode !== 'confirm' && msg && (
            <p className="text-xs bg-green-900/40 text-green-300 border border-green-700/40 px-3 py-2 rounded">
              {msg}
            </p>
          )}
          {mode !== 'confirm' && error && (
            <p className="text-xs bg-red-900/40 text-red-300 border border-red-700/40 px-3 py-2 rounded">
              {error}
            </p>
          )}

          {/* ── Sign In ── */}
          {mode === 'signin' && (
            <form action={signIn} className="space-y-4">
              {next && <input type="hidden" name="next" value={next} />}
              <div>
                <label className={labelCls}>Email</label>
                <input name="email" type="email" required className={inputCls} placeholder="you@example.com" autoComplete="email" />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input name="password" type="password" required minLength={6} className={inputCls} placeholder="••••••••" autoComplete="current-password" />
              </div>
              <SubmitButton label="Sign In" loadingLabel="Signing in…" variant="gold" />
              <div className="text-right">
                <Link href={`/auth/login?mode=forgot${next ? `&next=${encodeURIComponent(next)}` : ''}`} className="text-xs text-white/40 hover:text-brand-gold transition-colors">
                  Forgot password?
                </Link>
              </div>
            </form>
          )}

          {/* ── Sign Up ── */}
          {mode === 'signup' && (
            <form action={signUp} className="space-y-4">
              {next && <input type="hidden" name="next" value={next} />}
              <div>
                <label className={labelCls}>Email</label>
                <input name="email" type="email" required className={inputCls} placeholder="you@example.com" autoComplete="email" />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input name="password" type="password" required minLength={6} className={inputCls} placeholder="Min 6 characters" autoComplete="new-password" />
              </div>
              <SubmitButton label="Create Account" loadingLabel="Creating account…" variant="outline" />
            </form>
          )}

          {/* ── Forgot Password ── */}
          {mode === 'forgot' && (
            <form action={forgotPassword} className="space-y-4">
              <div>
                <label className={labelCls}>Email</label>
                <input name="email" type="email" required className={inputCls} placeholder="you@example.com" autoComplete="email" />
              </div>
              <SubmitButton label="Send Reset Link" loadingLabel="Sending…" variant="gold" />
              <Link href="/auth/login" className="block text-center text-xs text-white/40 hover:text-brand-gold transition-colors">
                ← Back to Sign In
              </Link>
            </form>
          )}

          {/* Google OAuth (sign-in and sign-up) */}
          {mode !== 'forgot' && mode !== 'confirm' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-brand-dark text-xs text-white/30">or</span>
                </div>
              </div>
              <GoogleButton next={next} darkMode />
            </>
          )}

          <p className="text-center text-xs text-white/20">
            Admin?{' '}
            <a href="/auth/admin" className="text-white/40 hover:text-white/60 underline transition-colors">
              Sign in here
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}
