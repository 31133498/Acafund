import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'

// Public landing
import LandingPage from './pages/LandingPage'

// Auth
import Register from './pages/Register'
import Login from './pages/Login'

// App pages
import MyCommunities from './pages/MyCommunities'
import CreateCommunity from './pages/CreateCommunity'
import JoinCommunity from './pages/JoinCommunity'
import CommunityHome from './pages/CommunityHome'
import Members from './pages/Members'
import Collections from './pages/Collections'
import CreateCollection from './pages/CreateCollection'
import CollectionDetail from './pages/CollectionDetail'
import PaymentReturn from './pages/PaymentReturn'
import Expenses from './pages/Expenses'
import CreateExpense from './pages/CreateExpense'
import ExpenseApproval from './pages/ExpenseApproval'
import Ledger from './pages/Ledger'
import TransparencyReport from './pages/TransparencyReport'
import TreasuryAssistant from './pages/TreasuryAssistant'

// Layout / guards
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import LoadingState from './components/ui/LoadingState'

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingState />
  return user ? <Navigate to="/communities" replace /> : <LandingPage />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root — landing or redirect to communities */}
      <Route path="/" element={<RootRedirect />} />

      {/* Auth */}
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />

      {/* Public payment return — no auth needed for the UI, but calls protected API internally */}
      <Route path="/payment-return" element={<PaymentReturn />} />

      {/* Public transparency report */}
      <Route path="/report/:collectionId" element={<TransparencyReport />} />

      {/* Protected app */}
      <Route element={<ProtectedRoute />}>
        {/* Community-less screens (no sidebar community nav) */}
        <Route element={<AppLayout />}>
          <Route path="/communities" element={<MyCommunities />} />
          <Route path="/communities/create" element={<CreateCommunity />} />
          <Route path="/communities/join" element={<JoinCommunity />} />
        </Route>

        {/* Community-scoped screens (sidebar shows community nav) */}
        <Route path="/communities/:id" element={<AppLayout />}>
          <Route index element={<CommunityHome />} />
          <Route path="members" element={<Members />} />
          <Route path="collections" element={<Collections />} />
          <Route path="collections/create" element={<CreateCollection />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="expenses/create" element={<CreateExpense />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="assistant" element={<TreasuryAssistant />} />
        </Route>

        {/* Collection & expense detail — still protected but outside community path */}
        <Route element={<AppLayout />}>
          <Route path="/collections/:id" element={<CollectionDetail />} />
          <Route path="/expenses/:id" element={<ExpenseApproval />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
