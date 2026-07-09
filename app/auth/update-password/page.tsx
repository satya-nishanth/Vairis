import { Suspense } from 'react'
import UpdatePasswordForm from './UpdatePasswordForm'

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
