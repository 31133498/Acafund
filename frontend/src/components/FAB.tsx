import { useState } from 'react'
import { Plus, Wallet, UserPlus, ReceiptText } from 'lucide-react'

const QUICK_ACTIONS = [
  { icon: Wallet, label: 'New Collection' },
  { icon: UserPlus, label: 'Add Member' },
  { icon: ReceiptText, label: 'Log Expense' },
]

export default function FAB() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col-reverse items-end gap-3">
      {open &&
        QUICK_ACTIONS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3 group">
            <span className="bg-black text-white text-[12px] font-bold tracking-wide uppercase px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {label}
            </span>
            <button className="w-12 h-12 bg-white border-4 border-black neo-shadow flex items-center justify-center hover:bg-primary-container transition-colors">
              <Icon size={18} />
            </button>
          </div>
        ))}

      <button
        onClick={() => setOpen(!open)}
        className={`w-16 h-16 bg-secondary text-white border-4 border-black rounded-full neo-shadow-lg flex items-center justify-center transition-all duration-200 ${
          open ? 'rotate-45 scale-110' : 'hover:scale-110 active:scale-95'
        }`}
        aria-label="Quick actions"
      >
        <Plus size={28} />
      </button>
    </div>
  )
}
