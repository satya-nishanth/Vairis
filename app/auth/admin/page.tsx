import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function adminSignIn(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect(`/auth/admin?error=${encodeURIComponent(error.message)}`)

  // Check admin before redirecting
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())
  if (!adminEmails.includes(email)) {
    await supabase.auth.signOut()
    redirect(`/auth/admin?error=${encodeURIComponent('Access denied. This portal is for authorised administrators only.')}`)
  }

  redirect('/admin/dashboard')
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  const inputCls =
    'w-full border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold bg-white font-mono'
  const labelCls = 'block text-xs text-gray-500 mb-1 tracking-widest uppercase font-mono'

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs text-gray-400 font-mono tracking-widest uppercase">Vairis</p>
          <h1 className="text-xl font-semibold text-gray-800 tracking-wide">Admin Portal</h1>
        </div>

        {/* Warning banner */}
        <div className="bg-amber-50 border border-amber-200 rounded px-4 py-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">Authorised personnel only.</span> This login is restricted
            to Vairis administrators. Unauthorised access attempts are logged.{' '}
            <a href="/" className="underline hover:text-amber-900">
              Return to store →
            </a>
          </p>
        </div>

        {error && (
          <p className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded font-mono">
            {error}
          </p>
        )}

        {/* Form */}
        <form action={adminSignIn} className="space-y-4 bg-white border border-gray-200 rounded p-6">
          <div>
            <label className={labelCls}>Admin Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              className={inputCls}
              placeholder="admin@thevairis.com"
            />
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              minLength={6}
              className={inputCls}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-gray-900 text-white text-xs font-mono tracking-widest uppercase hover:bg-gray-700 transition-colors"
          >
            Sign In to Admin
          </button>
        </form>

        <p className="text-center text-[10px] text-gray-300 font-mono">
          Session activity is monitored and logged.
        </p>
      </div>
    </main>
  )
}
