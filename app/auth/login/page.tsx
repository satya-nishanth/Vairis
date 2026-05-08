import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import GoogleButton from '@/components/auth/GoogleButton'

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
  redirect(`/auth/login?msg=${encodeURIComponent('Account created — sign in below')}${q}`)
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
  searchParams: Promise<{ error?: string; msg?: string; next?: string; mode?: string }>
}) {
  const { error, msg, next, mode = 'signin' } = await searchParams

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
          <img
            src="/images/vairis_main.jpeg"
            alt="VAIRIS Fine Jewellery"
            style={{ width: 'min(280px, 40vw)', height: 'auto', borderRadius: '4px' }}
            className="drop-shadow-[0_8px_40px_rgba(201,168,76,0.25)]"
          />
          <p className="font-display text-white/70 italic" style={{ fontSize: '18px', fontWeight: 300 }}>
            Where heritage meets the extraordinary.
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-8 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden text-center mb-8">
          <img src="/images/vairis_main.jpeg" alt="VAIRIS Fine Jewellery"
            style={{ height: '100px', width: 'auto', margin: '0 auto', borderRadius: '4px' }} />
        </div>

        <div className="w-full max-w-sm space-y-6">

          {/* Tabs */}
          {mode !== 'forgot' && (
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
          {msg && (
            <p className="text-xs bg-green-900/40 text-green-300 border border-green-700/40 px-3 py-2 rounded">
              {msg}
            </p>
          )}
          {error && (
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
              <button type="submit" className="w-full py-3.5 bg-brand-gold text-brand-dark text-sm font-semibold tracking-widest uppercase hover:bg-brand-gold/90 transition-colors">
                Sign In
              </button>
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
              <button type="submit" className="w-full py-3.5 border border-brand-gold/60 text-brand-gold text-sm tracking-widest uppercase hover:bg-brand-gold hover:text-brand-dark transition-colors">
                Create Account
              </button>
            </form>
          )}

          {/* ── Forgot Password ── */}
          {mode === 'forgot' && (
            <form action={forgotPassword} className="space-y-4">
              <div>
                <label className={labelCls}>Email</label>
                <input name="email" type="email" required className={inputCls} placeholder="you@example.com" autoComplete="email" />
              </div>
              <button type="submit" className="w-full py-3.5 bg-brand-gold text-brand-dark text-sm font-semibold tracking-widest uppercase hover:bg-brand-gold/90 transition-colors">
                Send Reset Link
              </button>
              <Link href="/auth/login" className="block text-center text-xs text-white/40 hover:text-brand-gold transition-colors">
                ← Back to Sign In
              </Link>
            </form>
          )}

          {/* Google OAuth (sign-in and sign-up) */}
          {mode !== 'forgot' && (
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
