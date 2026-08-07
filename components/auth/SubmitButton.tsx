'use client'
import { useFormStatus } from 'react-dom'

type Props = {
  label: string
  loadingLabel?: string
  variant?: 'gold' | 'outline'
}

export default function SubmitButton({ label, loadingLabel, variant = 'gold' }: Props) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={variant === 'gold' ? 'auth-btn auth-btn--gold' : 'auth-btn auth-btn--outline'}
    >
      {pending && <span className="auth-spinner" aria-hidden />}
      {pending ? (loadingLabel ?? label) : label}
    </button>
  )
}
