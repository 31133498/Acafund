import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingState from './ui/LoadingState'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingState message="Verifying session…" />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
