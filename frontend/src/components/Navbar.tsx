import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Logo from './Logo'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()

  const NAV_LINKS = ['Features', 'Dashboard', 'About']

  return (
    <nav className="sticky top-0 z-50 flex justify-between items-center px-4 md:px-12 py-4 bg-surface border-b-4 border-black">
      <div className="flex items-center gap-8">
        <button onClick={() => navigate('/')} className="hover:opacity-80 transition-opacity">
          <Logo size="md" />
        </button>
        <div className="hidden md:flex gap-6">
          {NAV_LINKS.map((item) => (
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
        {user ? (
          <button
            onClick={() => navigate('/communities')}
            className="bg-primary-container text-on-primary-container border-2 border-black neo-shadow neo-btn px-5 py-2 text-[14px] font-bold tracking-[0.05em] uppercase hidden sm:block"
          >
            Dashboard →
          </button>
        ) : (
          <>
            <button
              onClick={() => navigate('/login')}
              className="text-[14px] font-bold tracking-[0.05em] uppercase text-on-surface-variant hover:text-primary transition-colors px-3 py-2 hidden sm:block"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="bg-primary-container text-on-primary-container border-2 border-black neo-shadow neo-btn px-5 py-2 text-[14px] font-bold tracking-[0.05em] uppercase hidden sm:block"
            >
              Get Started
            </button>
          </>
        )}
        <button
          className="md:hidden text-on-surface p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-surface border-b-4 border-black flex flex-col p-4 gap-2 md:hidden z-50">
          {NAV_LINKS.map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-[14px] font-bold tracking-[0.05em] uppercase text-on-surface-variant hover:text-primary transition-colors py-2 border-b border-outline-variant"
              onClick={() => setMenuOpen(false)}
            >
              {item}
            </a>
          ))}
          {user ? (
            <button
              onClick={() => { setMenuOpen(false); navigate('/communities') }}
              className="mt-2 bg-primary-container text-on-primary-container border-2 border-black neo-shadow neo-btn py-2 text-[14px] font-bold tracking-[0.05em] uppercase"
            >
              Dashboard →
            </button>
          ) : (
            <>
              <button
                onClick={() => { setMenuOpen(false); navigate('/login') }}
                className="mt-2 bg-white border-2 border-black neo-shadow neo-btn py-2 text-[14px] font-bold tracking-[0.05em] uppercase"
              >
                Sign In
              </button>
              <button
                onClick={() => { setMenuOpen(false); navigate('/register') }}
                className="bg-primary-container text-on-primary-container border-2 border-black neo-shadow neo-btn py-2 text-[14px] font-bold tracking-[0.05em] uppercase"
              >
                Get Started
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
