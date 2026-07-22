import { useEffect, useRef } from 'react'
import { CalendarDays, Wallet, CheckSquare, Eye, LineChart, type LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  desc: string
  bg: string
  size: string
  iconBg: string
  large: boolean
  horizontal?: boolean
  iconWhite?: boolean
}

const FEATURES: Feature[] = [
  {
    icon: CalendarDays,
    title: 'Plan & Vote',
    desc: 'Propose budgets, vote as a community. Every decision is logged before a naira moves.',
    bg: 'bg-white',
    size: 'md:col-span-2',
    iconBg: 'bg-primary-container',
    large: true,
  },
  {
    icon: Wallet,
    title: 'Multi-channel Collection',
    desc: 'Bank transfer, USSD, or card. Auto-reconciliation — no more matching screenshots to names.',
    bg: 'bg-secondary-fixed',
    size: 'md:col-span-2',
    iconBg: 'bg-white',
    large: true,
  },
  {
    icon: CheckSquare,
    title: 'AI Verify',
    desc: 'AI-powered receipt verification stops double-accounting in its tracks.',
    bg: 'bg-tertiary-container',
    size: 'md:col-span-1',
    iconBg: 'bg-white',
    large: false,
  },
  {
    icon: Eye,
    title: 'Total Transparency',
    desc: 'Public dashboard. Real-time balance. Every verified expense in the open.',
    bg: 'bg-white',
    size: 'md:col-span-2',
    iconBg: 'bg-primary',
    large: true,
    horizontal: true,
    iconWhite: true,
  },
  {
    icon: LineChart,
    title: 'Report',
    desc: 'One-click financial reporting for semester hand-overs.',
    bg: 'bg-secondary-container',
    size: 'md:col-span-1',
    iconBg: 'bg-white',
    large: false,
  },
]

export default function Features() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const cards = ref.current?.querySelectorAll('[data-animate]')
    if (!cards) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement
            el.style.opacity = '1'
            el.style.transform = 'translateY(0)'
          }
        })
      },
      { threshold: 0.1 },
    )
    cards.forEach((c, i) => {
      const el = c as HTMLElement
      el.style.opacity = '0'
      el.style.transform = 'translateY(32px)'
      el.style.transition = `opacity 0.5s ease ${i * 80}ms, transform 0.5s ease ${i * 80}ms`
      observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} id="features" className="px-4 md:px-12 py-20 bg-surface-container-low">
      <div className="mb-16 text-center">
        <h2 className="text-[40px] leading-[1.2] tracking-[-0.01em] font-bold">
          Built for Accountability
        </h2>
        <div className="w-24 h-2 bg-secondary mx-auto mt-4 border-2 border-black" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {FEATURES.map(({ icon: Icon, title, desc, bg, size, iconBg, large, horizontal, iconWhite }) => (
          <div
            key={title}
            data-animate
            className={`${size} ${bg} border-4 border-black neo-shadow-lg p-8 group hover:-translate-y-2 transition-transform cursor-default ${
              horizontal ? 'flex items-center gap-6' : ''
            }`}
          >
            <div
              className={`${iconBg} border-2 border-black flex items-center justify-center flex-shrink-0 ${
                large ? 'w-16 h-16' : 'w-12 h-12'
              } ${horizontal ? '' : large ? 'mb-6' : 'mb-4'}`}
            >
              <Icon size={large ? 28 : 20} className={iconWhite ? 'text-white' : ''} />
            </div>
            <div>
              <h3 className={`font-bold ${large ? 'text-[24px] mb-4' : 'text-[18px] mb-2'}`}>
                {title}
              </h3>
              <p className={`text-on-surface-variant leading-relaxed ${large ? 'text-[16px]' : 'text-[14px]'}`}>
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
