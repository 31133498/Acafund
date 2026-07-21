import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export default function Input({ label, error, id, className = '', ...props }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-[12px] font-bold uppercase tracking-[0.08em]">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full border-2 border-black bg-white px-4 py-3 text-[15px] font-sans focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-on-surface-variant/50 disabled:bg-surface-container disabled:cursor-not-allowed ${
          error ? 'border-error ring-2 ring-error' : ''
        } ${className}`}
        {...props}
      />
      {error && <p className="text-[12px] text-error font-bold">{error}</p>}
    </div>
  )
}
