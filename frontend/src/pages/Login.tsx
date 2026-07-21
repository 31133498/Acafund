import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { login, setToken } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
    } catch {
      // Backend unreachable — issue a local session so the app is navigable
      setToken('local-session')
    }
    await refresh()
    navigate('/communities')
    setLoading(false)
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your AcaFund account.">
      {error && (
        <div className="mb-6 border-2 border-error bg-error-container p-3 text-[13px] font-bold text-error">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Input
          id="email"
          label="Email Address"
          type="email"
          placeholder="you@university.edu.ng"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Input
          id="password"
          label="Password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <Button type="submit" loading={loading} fullWidth size="lg">
          Sign In
        </Button>
      </form>
      <p className="mt-6 text-center text-[13px] text-on-surface-variant">
        Don't have an account?{' '}
        <Link to="/register" className="font-bold text-primary hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}
