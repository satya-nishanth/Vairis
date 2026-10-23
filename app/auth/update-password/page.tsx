import type { Metadata } from 'next'
import { Suspense } from 'react'
import UpdatePasswordForm from './UpdatePasswordForm'

export const metadata: Metadata = {
  title: 'Set New Password',
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <p className="auth-lead">Verifying reset link…</p>
        </main>
      }
    >
      <UpdatePasswordForm />
    </Suspense>
  )
}
