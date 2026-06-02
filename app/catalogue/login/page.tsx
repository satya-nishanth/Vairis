'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

export default function CatalogueLoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/catalogue/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      let data: { error?: string } = {}
      try {
        data = await res.json()
      } catch {
        setError(res.ok ? 'Unexpected server response' : `Server error (${res.status}). Restart dev server and try again.`)
        return
      }
      if (!res.ok) { setError(data.error ?? 'Login failed'); return }
      router.replace('/catalogue')
    } catch {
      setError('Cannot reach server. Run: npm run dev — then open http://localhost:3000/catalogue/login')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-brand-gold/60 transition'
  const labelCls = 'block text-xs text-white/50 tracking-widest uppercase mb-1.5'

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="mb-8">
        <Image src="/images/vairius_logo.png" alt="VAIRIS" width={80} height={40} className="opacity-90" />
      </div>

      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-white text-center mb-1">Welcome Back</h1>
        <p className="text-white/40 text-center text-sm mb-8">Log in to continue your catalogue</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Identifier */}
          <div>
            <label className={labelCls}>Email / Username / Phone</label>
            <input
              type="text"
              autoComplete="username"
              placeholder="Enter email, username or phone"
              value={form.identifier}
              onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))}
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
                autoComplete="current-password"
                placeholder="Your password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
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

          {error && (
            <p className="text-red-400 text-sm text-center pt-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-brand-gold text-brand-dark font-semibold tracking-widest uppercase text-sm rounded-sm hover:bg-brand-gold/90 active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading ? 'Logging in…' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-white/30 text-sm mt-8">
          Don&apos;t have an account?{' '}
          <Link href="/catalogue/signup" className="text-brand-gold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
