import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Wallet, UserPlus, ReceiptText } from 'lucide-react'

export default function FAB() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const match = pathname.match(/^\/communities\/(\d+)/)
  const communityId = match ? match[1] : null

  if (!communityId) return null

  const QUICK_ACTIONS = [
    {
      icon: Wallet,
      label: 'New Collection',
      onClick: () => navigate(`/communities/${communityId}/collections/create`),
    },
    {
      icon: ReceiptText,
      label: 'New Expense',
      onClick: () => navigate(`/communities/${communityId}/expenses/create`),
    },
    {
      icon: UserPlus,
      label: 'Members',
      onClick: () => navigate(`/communities/${communityId}/members`),
    },
  ]

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col-reverse items-end gap-3">
      {open &&
        QUICK_ACTIONS.map(({ icon: Icon, label, onClick }) => (
          <div key={label} className="flex items-center gap-3 group">
            <span className="bg-black text-white text-[11px] font-bold tracking-wide uppercase px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap neo-shadow-sm">
              {label}
            </span>
            <button
              onClick={() => { setOpen(false); onClick() }}
              className="w-12 h-12 bg-white border-4 border-black neo-shadow flex items-center justify-center hover:bg-primary-container transition-colors"
            >
              <Icon size={18} />
            </button>
          </div>
        ))}

      <button
        onClick={() => setOpen(!open)}
        className={`w-16 h-16 bg-primary text-white border-4 border-black neo-shadow-lg flex items-center justify-center transition-all duration-200 ${
          open ? 'rotate-45 scale-110' : 'hover:scale-110 active:scale-95'
        }`}
        aria-label="Quick actions"
      >
        <Plus size={28} />
      </button>
    </div>
  )
}
