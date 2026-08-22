import { Icon } from '@iconify/react'

type Props = {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'gold' | 'danger' | 'success'
}

const VARIANTS = {
  default: 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700',
  gold: 'border-brand-gold/30 text-brand-gold hover:bg-brand-gold/5',
  danger: 'border-red-100 text-red-600 hover:bg-red-50',
  success: 'border-green-100 text-green-700 hover:bg-green-50',
}

export default function IconButton({
  icon,
  label,
  onClick,
  disabled,
  variant = 'default',
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`p-2 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]}`}
    >
      <Icon icon={icon} width={18} height={18} />
    </button>
  )
}
