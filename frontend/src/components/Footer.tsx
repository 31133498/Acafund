import { AtSign, Network, ExternalLink } from 'lucide-react'
import Logo from './Logo'

const SOCIAL = [
  { icon: AtSign, label: 'Email' },
  { icon: Network, label: 'Community' },
  { icon: ExternalLink, label: 'LinkedIn' },
]

export default function Footer() {
  return (
    <footer className="w-full py-12 px-4 md:px-12 bg-surface-container-highest border-t-4 border-black">
      <div className="flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex flex-col items-center md:items-start gap-3">
          <Logo size="md" />
          <p className="text-[14px] text-on-surface-variant text-center md:text-left max-w-xs leading-relaxed">
            © 2026 AcaFund. Empowering African student communities through radical financial transparency.
          </p>
        </div>

        <div className="flex gap-6 flex-wrap justify-center">
          {['Privacy Policy', 'Terms of Service', 'Contact Support'].map((link) => (
            <a
              key={link}
              href="#"
              className="text-[14px] font-bold tracking-[0.05em] uppercase text-on-surface-variant hover:text-primary underline transition-colors"
            >
              {link}
            </a>
          ))}
        </div>

        <div className="flex gap-3">
          {SOCIAL.map(({ icon: Icon, label }) => (
            <button
              key={label}
              aria-label={label}
              className="w-10 h-10 border-2 border-black flex items-center justify-center neo-shadow-sm neo-btn hover:bg-primary-container transition-colors"
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>
    </footer>
  )
}
