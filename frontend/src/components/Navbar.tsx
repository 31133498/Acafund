import { useState } from 'react'
import { Bell, HelpCircle, Menu, X } from 'lucide-react'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 flex justify-between items-center px-4 md:px-12 py-4 bg-surface border-b-4 border-black">
      <div className="flex items-center gap-8">
        <span className="text-2xl font-bold tracking-tight text-on-surface">AcaFund</span>
        <div className="hidden md:flex gap-6">
          {['Features', 'Dashboard', 'About'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-[14px] font-bold tracking-[0.05em] uppercase text-on-surface-variant hover:text-primary transition-colors"
            >
              {item}
            </a>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="text-on-surface-variant hover:text-primary p-2 transition-colors" aria-label="Notifications">
          <Bell size={20} />
        </button>
        <button className="text-on-surface-variant hover:text-primary p-2 transition-colors" aria-label="Help">
          <HelpCircle size={20} />
        </button>
        <button className="bg-primary-container text-on-primary-container border-2 border-black neo-shadow neo-btn px-5 py-2 text-[14px] font-bold tracking-[0.05em] uppercase hidden sm:block">
          Profile
        </button>
        <button
          className="md:hidden text-on-surface p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-surface border-b-4 border-black flex flex-col p-4 gap-4 md:hidden z-50">
          {['Features', 'Dashboard', 'About'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-[14px] font-bold tracking-[0.05em] uppercase text-on-surface-variant hover:text-primary transition-colors py-2 border-b border-outline-variant last:border-0"
              onClick={() => setMenuOpen(false)}
            >
              {item}
            </a>
          ))}
        </div>
      )}
    </nav>
  )
}
