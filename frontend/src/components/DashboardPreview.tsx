import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Wallet,
  BarChart2,
  Users,
  ShieldCheck,
} from 'lucide-react'

const FEED = [
  { name: 'Adeola O.', action: 'paid', amount: '₦5,000', time: '2 mins ago' },
  { name: 'Chidi K.', action: 'verified receipt #A492', amount: '', time: '15 mins ago' },
  { name: 'Blessing E.', action: 'paid', amount: '₦10,000', time: '32 mins ago' },
  { name: 'Tunde A.', action: 'flagged duplicate #B201', amount: '', time: '1 hr ago' },
]

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Wallet, label: 'Collections', active: false },
  { icon: BarChart2, label: 'Audit Logs', active: false },
  { icon: Users, label: 'Members', active: false },
]

export default function DashboardPreview() {
  const [feedItems, setFeedItems] = useState(FEED.slice(0, 2))

  useEffect(() => {
    const interval = setInterval(() => {
      setFeedItems((prev) => {
        const nextIdx = prev.length % FEED.length
        return [FEED[nextIdx], ...prev.slice(0, 2)]
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="border-4 border-black neo-shadow-lg bg-surface-container overflow-hidden">
      {/* Window bar */}
      <div className="h-10 bg-black flex items-center px-4 gap-2">
        <div className="w-3 h-3 rounded-full bg-error" />
        <div className="w-3 h-3 rounded-full bg-secondary-container" />
        <div className="w-3 h-3 rounded-full bg-primary-container" />
        <span className="ml-4 text-white text-[11px] font-bold uppercase tracking-widest">
          acafund_admin_v1.0
        </span>
      </div>

      <div className="p-6 md:p-10 bg-white grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Sidebar */}
        <div className="md:col-span-3 flex flex-col gap-4">
          <div className="bg-primary-container border-2 border-black p-4 neo-shadow">
            <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-on-primary-container mb-1">
              Total Balance
            </p>
            <p className="text-[24px] font-semibold leading-tight">₦4,250,000</p>
            <p className="text-[12px] text-on-primary-container/70 mt-1 font-bold">
              +₦320,000 this week
            </p>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`flex items-center gap-3 p-3 border-2 transition-all cursor-pointer ${
                  active
                    ? 'bg-secondary-fixed border-black'
                    : 'border-transparent hover:border-black hover:bg-surface-container-low'
                }`}
              >
                <Icon size={18} />
                <span className="text-[14px] font-bold">{label}</span>
              </div>
            ))}
          </nav>
        </div>

        {/* Main panel */}
        <div className="md:col-span-9 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h3 className="text-[24px] font-semibold">Active Collections</h3>
            <span className="bg-tertiary-container border-2 border-black px-3 py-1 text-[11px] font-bold tracking-widest uppercase">
              3 Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'Departmental Dues', pct: 75, color: 'bg-primary', collected: '₦1,500,000', goal: '₦2M' },
              { title: 'Final Year Dinner', pct: 40, color: 'bg-secondary-container', collected: '₦800,000', goal: '₦2M' },
              { title: 'Convocation Fee', pct: 20, color: 'bg-tertiary-fixed-dim', collected: '₦400,000', goal: '₦2M' },
            ].map(({ title, pct, color, collected, goal }) => (
              <div
                key={title}
                className="border-2 border-black p-4 neo-shadow hover:bg-surface-container-low transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <p className="text-[14px] font-bold">{title}</p>
                  <span className="text-[12px] font-bold text-on-surface-variant">{pct}%</span>
                </div>
                <div className="w-full bg-surface-container border-2 border-black h-3 mb-3">
                  <div
                    className={`${color} h-full border-r-2 border-black transition-all duration-1000`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[12px] font-bold text-on-surface-variant">
                  <span>{collected} collected</span>
                  <span>Goal: {goal}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Live feed */}
          <div className="border-2 border-black p-4 bg-surface-container">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={18} className="text-primary" />
              <span className="text-[12px] font-bold uppercase tracking-widest">Live Activity Feed</span>
              <span className="ml-auto w-2 h-2 rounded-full bg-primary animate-pulse" />
            </div>
            <div className="flex flex-col gap-3">
              {feedItems.map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  className="flex justify-between items-center text-[14px] border-b border-black/10 pb-2 last:border-0 last:pb-0"
                >
                  <span>
                    <span className="font-bold">{item.name}</span>{' '}
                    <span className="text-on-surface-variant">{item.action}</span>
                    {item.amount && <span className="font-bold"> {item.amount}</span>}
                  </span>
                  <span className="text-[12px] text-on-surface-variant ml-4 whitespace-nowrap">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
