import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import GoogleButton from '@/components/auth/GoogleButton'

async function signIn(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect(`/auth/login?error=${encodeURIComponent(error.message)}`)
  redirect('/admin/dashboard')
}

async function signUp(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) redirect(`/auth/login?error=${encodeURIComponent(error.message)}`)
  redirect(`/auth/login?msg=${encodeURIComponent('Account created — sign in below')}`)
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; msg?: string }>
}) {
  const { error, msg } = await searchParams

  const inputCls =
    'w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold bg-white'
  const labelCls = 'block text-xs text-gray-500 mb-1 tracking-widest uppercase'

  return (
    <main className="min-h-screen bg-brand-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="font-display text-4xl tracking-widest text-brand-dark">VAIRIS</h1>
          <p className="text-sm text-gray-400 mt-2 tracking-wide">Admin Access</p>
        </div>

        {msg && (
          <p className="text-xs bg-green-50 text-green-700 border border-green-100 px-3 py-2 rounded">
            {msg}
          </p>
        )}
        {error && (
          <p className="text-xs bg-red-50 text-red-600 border border-red-100 px-3 py-2 rounded">
            {error}
          </p>
        )}

        {/* Sign In */}
        <form action={signIn} className="space-y-4">
          <div>
            <label className={labelCls}>Email</label>
            <input
              name="email"
              type="email"
              required
              className={inputCls}
              placeholder="nish99.sn@gmail.com"
            />
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className={inputCls}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-brand-dark text-white text-sm tracking-widest uppercase hover:bg-brand-light transition-colors"
          >
            Sign In
          </button>
        </form>

        {/* Create account */}
        <details className="group">
          <summary className="text-xs text-gray-400 hover:text-brand-gold cursor-pointer list-none text-center">
            No account? Create one →
          </summary>
          <form action={signUp} className="mt-4 space-y-3">
            <input
              name="email"
              type="email"
              required
              className={inputCls}
              placeholder="Email"
            />
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className={inputCls}
              placeholder="Password (min 6 chars)"
            />
            <button
              type="submit"
              className="w-full py-3 border border-brand-dark text-brand-dark text-sm tracking-widest uppercase hover:bg-brand-dark hover:text-white transition-colors"
            >
              Create Account
            </button>
          </form>
        </details>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-brand-cream text-xs text-gray-300">or</span>
          </div>
        </div>

        <GoogleButton />
      </div>
    </main>
  )
}
