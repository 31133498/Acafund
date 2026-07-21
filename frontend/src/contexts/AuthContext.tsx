import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { logout as apiLogout, hasToken } from '../lib/api'
import type { User } from '../lib/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Placeholder user used when a token exists but the backend is unreachable.
// Replaced by real data once the backend is live and getMe() works.
const PLACEHOLDER_USER: User = {
  id: 0,
  full_name: 'You',
  email: '',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!hasToken()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      // Try the real endpoint; fall back to placeholder if backend is unreachable
      const { getMe } = await import('../lib/api')
      const me = await getMe()
      setUser(me)
    } catch {
      // Backend down — treat the stored token as valid so navigation works
      setUser(PLACEHOLDER_USER)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    apiLogout()
    setUser(null)
  }

  useEffect(() => { refresh() }, [])

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
