import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'

async function adminSignIn(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect(`/auth/admin?error=${encodeURIComponent(error.message)}`)

  // Check admin before redirecting
  const allowed = await isAdminEmail(email)
  if (!allowed) {
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

  return (
    <main className="admin-auth">
      <div className="admin-auth__card">
        <div className="admin-auth__head">
          <p className="admin-auth__brand">Vairis</p>
          <h1 className="admin-auth__title">Admin Portal</h1>
        </div>

        <div className="admin-auth__warning">
          <strong>Authorised personnel only.</strong> This login is restricted to Vairis
          administrators. Unauthorised access attempts are logged.{' '}
          <Link href="/">Return to store →</Link>
        </div>

        {error && <p className="admin-auth__error">{error}</p>}

        <form action={adminSignIn} className="admin-auth__form">
          <div>
            <label htmlFor="admin-email">Admin Email</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="admin-auth__input"
              placeholder="admin@thevairis.com"
            />
          </div>
          <div>
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              minLength={6}
              className="admin-auth__input"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="admin-auth__submit">
            Sign In to Admin
          </button>
        </form>

        <p className="admin-auth__foot">Session activity is monitored and logged.</p>
      </div>
    </main>
  )
}
