import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Logo from './Logo'

export default function AuthLayout({ children, title, subtitle }: {
  children: ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="mb-8 hover:opacity-80 transition-opacity">
        <Logo size="lg" />
      </Link>
      <div className="w-full max-w-md border-4 border-black neo-shadow-lg bg-white p-8">
        <div className="mb-8">
          <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-[15px] text-on-surface-variant mt-1">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
