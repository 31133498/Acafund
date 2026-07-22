import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Wallet, Receipt, BookOpen,
  Sparkles, LogOut, Menu, X, ChevronLeft,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Logo from './Logo'
import FAB from './FAB'

function NavItem({
  to, icon: Icon, label, onClick,
}: {
  to?: string; icon: React.ElementType; label: string; onClick?: () => void
}) {
  const base = 'flex items-center gap-3 px-4 py-3 text-[13px] font-bold tracking-[0.04em] uppercase border-2 transition-all'
  if (to) {
    return (
      <NavLink
        to={to}
        end
        className={({ isActive }) =>
          `${base} ${isActive
            ? 'bg-primary-container text-on-primary-container border-black neo-shadow-sm'
            : 'border-transparent text-on-surface-variant hover:border-black hover:text-on-surface'
          }`
        }
        onClick={onClick}
      >
        <Icon size={16} />
        {label}
      </NavLink>
    )
  }
  return (
    <button
      className={`${base} border-transparent text-on-surface-variant hover:border-black hover:text-on-surface w-full text-left`}
      onClick={onClick}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const communityMatch = pathname.match(/^\/communities\/(\d+)/)
  const communityId = communityMatch ? communityMatch[1] : undefined
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const communityLinks = communityId
    ? [
        { to: `/communities/${communityId}`, icon: LayoutDashboard, label: 'Dashboard' },
        { to: `/communities/${communityId}/members`, icon: Users, label: 'Members' },
        { to: `/communities/${communityId}/collections`, icon: Wallet, label: 'Collections' },
        { to: `/communities/${communityId}/expenses`, icon: Receipt, label: 'Expenses' },
        { to: `/communities/${communityId}/ledger`, icon: BookOpen, label: 'Ledger' },
        { to: `/communities/${communityId}/assistant`, icon: Sparkles, label: 'AI Assistant' },
      ]
    : []

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Logo + mobile close */}
      <div className="px-4 py-4 border-b-2 border-black flex items-center justify-between">
        <Logo size="md" />
        <button
          className="md:hidden p-1 -mr-1"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X size={22} />
        </button>
      </div>

      {/* Back to communities */}
      {communityId && (
        <NavLink
          to="/communities"
          className="flex items-center gap-2 px-4 py-3 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary border-b-2 border-black transition-colors"
          onClick={() => setMobileOpen(false)}
        >
          <ChevronLeft size={14} />
          My Communities
        </NavLink>
      )}

      {/* Nav links */}
      <nav className="flex-1 flex flex-col gap-1 px-2 py-3">
        {!communityId && (
          <NavItem
            to="/communities"
            icon={LayoutDashboard}
            label="My Communities"
            onClick={() => setMobileOpen(false)}
          />
        )}
        {communityLinks.map((link) => (
          <NavItem key={link.to} {...link} onClick={() => setMobileOpen(false)} />
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t-2 border-black px-4 py-4">
        <p className="text-[13px] font-bold truncate">{user?.full_name}</p>
        <p className="text-[11px] text-on-surface-variant truncate mb-3">{user?.email}</p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-error hover:underline"
        >
          <LogOut size={13} />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r-4 border-black bg-surface flex-shrink-0 sticky top-0 inset-y-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[300px] border-r-4 border-black bg-surface flex flex-col md:hidden transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-4 px-4 py-3 bg-surface border-b-4 border-black">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <Logo size="sm" />
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
      <FAB />
    </div>
  )
}
