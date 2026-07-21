import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'black' | 'white' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
  fullWidth?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary-container text-on-primary-container border-2 border-black neo-shadow neo-btn',
  black:   'bg-black text-white border-2 border-black neo-shadow neo-btn',
  white:   'bg-white text-black border-2 border-black neo-shadow neo-btn',
  danger:  'bg-error text-white border-2 border-black neo-shadow neo-btn',
  ghost:   'bg-transparent text-on-surface border-2 border-transparent hover:border-black transition-colors',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-4 py-2 text-[12px]',
  md: 'px-5 py-3 text-[13px]',
  lg: 'px-8 py-4 text-[14px]',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-bold tracking-[0.05em] uppercase transition-all ${
        variantClasses[variant]
      } ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
      } ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : null}
      {children}
    </button>
  )
}
