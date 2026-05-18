'use client'
import { useFormStatus } from 'react-dom'

type Props = {
  label: string
  loadingLabel?: string
  variant?: 'gold' | 'outline'
}

export default function SubmitButton({ label, loadingLabel, variant = 'gold' }: Props) {
  const { pending } = useFormStatus()

  const base = 'w-full py-3.5 text-sm tracking-widest uppercase transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed'
  const styles =
    variant === 'gold'
      ? `${base} bg-brand-gold text-brand-dark font-semibold hover:bg-brand-gold/90`
      : `${base} border border-brand-gold/60 text-brand-gold hover:bg-brand-gold hover:text-brand-dark`

  return (
    <button type="submit" disabled={pending} className={styles}>
      {pending && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {pending ? (loadingLabel ?? label) : label}
    </button>
  )
}
