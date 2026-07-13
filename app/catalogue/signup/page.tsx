'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

type Field = 'username' | 'email' | 'phone' | 'password' | 'confirmPassword'

export default function CatalogueSignupPage() {
  const router = useRouter()
  const [form, setForm] = useState<Record<Field, string>>({
    username: '', email: '', phone: '', password: '', confirmPassword: '',
  })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: Field) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/catalogue/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          phone: form.phone,
          password: form.password,
        }),
      })
      let data: { error?: string } = {}
      try {
        data = await res.json()
      } catch {
        setError(res.ok ? 'Unexpected server response' : `Server error (${res.status}). Restart dev server and try again.`)
        return
      }
      if (!res.ok) { setError(data.error ?? 'Sign up failed'); return }
      router.replace('/catalogue')
    } catch {
      setError('Cannot reach server. Run: npm run dev — then open http://localhost:3000/catalogue/signup')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-brand-gold/60 transition'
  const labelCls = 'block text-xs text-white/50 tracking-widest uppercase mb-1.5'

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-12">
      <div className="mb-8">
        <Image src="/images/vairius_logo.png" alt="VAIRIS" width={80} height={40} className="opacity-90" />
      </div>

      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-white text-center mb-1">Create Account</h1>
        <p className="text-white/40 text-center text-sm mb-8">Sign up to browse the catalogue</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className={labelCls}>Username</label>
            <input
              type="text"
              autoComplete="username"
              placeholder="e.g. nishi_vairis"
              value={form.username}
              onChange={set('username')}
              required
              className={inputCls}
            />
          </div>

          {/* Email */}
          <div>
            <label className={labelCls}>Email</label>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              required
              className={inputCls}
            />
          </div>

          {/* Phone */}
          <div>
            <label className={labelCls}>Phone</label>
            <input
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={set('phone')}
              required
              className={inputCls}
            />
          </div>

          {/* Password */}
          <div>
            <label className={labelCls}>Password</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={set('password')}
                required
                className={inputCls + ' pr-12'}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs tracking-wide transition"
              >
                {showPwd ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className={labelCls}>Confirm Password</label>
            <input
              type={showPwd ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repeat password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              required
              className={inputCls}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center pt-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-brand-gold text-brand-dark font-semibold tracking-widest uppercase text-sm rounded-sm hover:bg-brand-gold/90 active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading ? 'Creating Account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-white/30 text-sm mt-8">
          Already have an account?{' '}
          <Link href="/catalogue/login" className="text-brand-gold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
