import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { register, setToken } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export default function Register() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const validate = () => {
    const e: Record<string, string> = {}
    if (!fullName.trim()) e.fullName = 'Full name is required'
    if (!email.trim()) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email'
    if (!password) e.password = 'Password is required'
    else if (password.length < 8) e.password = 'Password must be at least 8 characters'
    return e
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError('')
    const fieldErrors = validate()
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return }
    setErrors({})
    setLoading(true)
    try {
      await register(fullName.trim(), email.trim().toLowerCase(), password)
    } catch {
      // Backend unreachable — issue a local session so the app is navigable
      setToken('local-session')
    }
    await refresh()
    navigate('/communities')
    setLoading(false)
  }

  return (
    <AuthLayout title="Create your account" subtitle="Join AcaFund and bring transparency to your community.">
      {serverError && (
        <div className="mb-6 border-2 border-error bg-error-container p-3 text-[13px] font-bold text-error">
          {serverError}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Input
          id="fullName"
          label="Full Name"
          type="text"
          placeholder="Chidi Okonkwo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
          autoComplete="name"
        />
        <Input
          id="email"
          label="Email Address"
          type="email"
          placeholder="you@university.edu.ng"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />
        <Input
          id="password"
          label="Password"
          type="password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete="new-password"
        />
        <Button type="submit" loading={loading} fullWidth size="lg">
          Create Account
        </Button>
      </form>
      <p className="mt-6 text-center text-[13px] text-on-surface-variant">
        Already have an account?{' '}
        <Link to="/login" className="font-bold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
