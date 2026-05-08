import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import GoogleButton from '@/components/auth/GoogleButton'

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
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}${q}`)
  }
  const q = next ? `&next=${encodeURIComponent(next)}` : ''
  redirect(`/auth/login?msg=${encodeURIComponent('Account created — sign in below')}${q}`)
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; msg?: string; next?: string }>
}) {
  const { error, msg, next } = await searchParams

  const inputCls =
    'w-full border border-white/20 bg-white/10 text-white placeholder-white/40 px-4 py-3 text-sm focus:outline-none focus:border-brand-gold focus:bg-white/20 transition-all backdrop-blur-sm'
  const labelCls = 'block text-xs text-white/60 mb-1.5 tracking-[0.2em] uppercase'

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
          <p className="text-brand-gold/50 tracking-[0.5em] text-xs uppercase">Fine Jewellery</p>
          <h1 className="font-display text-7xl text-white tracking-[0.2em]">VAIRIS</h1>
          <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">
            Crafted with precision. Worn with pride.
          </p>
          <div className="w-16 h-px bg-brand-gold/30 mx-auto" />
          <p className="text-white/30 text-xs tracking-widest uppercase">
            Sign in to save favourites &amp; track orders
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-8 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden text-center mb-10 space-y-2">
          <h1 className="font-display text-4xl text-white tracking-widest">VAIRIS</h1>
          <p className="text-white/40 text-xs tracking-widest uppercase">Fine Jewellery</p>
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="font-display text-2xl text-white">Welcome back</h2>
            <p className="text-white/40 text-sm">
              {next ? 'Sign in to continue' : 'Sign in to your account'}
            </p>
          </div>

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

          {/* Sign In */}
          <form action={signIn} className="space-y-4">
            {next && <input type="hidden" name="next" value={next} />}
            <div>
              <label className={labelCls}>Email</label>
              <input name="email" type="email" required className={inputCls} placeholder="you@example.com" />
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <input name="password" type="password" required minLength={6} className={inputCls} placeholder="••••••••" />
            </div>
            <button
              type="submit"
              className="w-full py-3.5 bg-brand-gold text-brand-dark text-sm font-semibold tracking-widest uppercase hover:bg-brand-gold/90 transition-colors"
            >
              Sign In
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-brand-dark text-xs text-white/30">or</span>
            </div>
          </div>

          <GoogleButton next={next} darkMode />

          {/* Create account */}
          <details className="group">
            <summary className="text-sm text-white/40 hover:text-brand-gold cursor-pointer list-none text-center transition-colors">
              New here? Create an account →
            </summary>
            <form action={signUp} className="mt-4 space-y-3">
              {next && <input type="hidden" name="next" value={next} />}
              <input
                name="email"
                type="email"
                required
                className={inputCls}
                placeholder="your@email.com"
              />
              <input
                name="password"
                type="password"
                required
                minLength={6}
                className={inputCls}
                placeholder="Choose a password (min 6 chars)"
              />
              <button
                type="submit"
                className="w-full py-3.5 border border-brand-gold/50 text-brand-gold text-sm tracking-widest uppercase hover:bg-brand-gold/10 transition-colors"
              >
                Create Account
              </button>
            </form>
          </details>

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
