import { Suspense } from 'react'
import UpdatePasswordForm from './UpdatePasswordForm'

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-brand-dark flex items-center justify-center">
        <p className="text-white/40 text-sm animate-pulse">Verifying reset link…</p>
      </main>
    }>
      <UpdatePasswordForm />
    </Suspense>
  )
}
