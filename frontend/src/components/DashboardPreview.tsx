import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard,
  Wallet,
  ClipboardList,
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

const FEED = [
  { name: 'Adeola O.', action: 'paid', amount: '₦5,000', time: '2 mins ago' },
  { name: 'Chidi K.', action: 'verified receipt #A492', amount: '', time: '15 mins ago' },
  { name: 'Blessing E.', action: 'paid', amount: '₦10,000', time: '32 mins ago' },
  { name: 'Tunde A.', action: 'flagged duplicate #B201', amount: '', time: '1 hr ago' },
  { name: 'Ngozi A.', action: 'paid', amount: '₦5,000', time: '2 hrs ago' },
]

const COLLECTIONS = [
  { title: 'Departmental Dues', pct: 75, color: 'bg-primary', collected: '₦1,500,000', goal: '₦2,000,000', status: 'Active', members: 120 },
  { title: 'Final Year Dinner', pct: 40, color: 'bg-secondary-container', collected: '₦800,000', goal: '₦2,000,000', status: 'Active', members: 89 },
  { title: 'Convocation Fee', pct: 20, color: 'bg-tertiary-fixed-dim', collected: '₦400,000', goal: '₦2,000,000', status: 'Active', members: 45 },
  { title: 'Study Materials', pct: 100, color: 'bg-primary-container', collected: '₦500,000', goal: '₦500,000', status: 'Closed', members: 120 },
]

const AUDIT_LOGS = [
  { type: 'credit', desc: 'Adeola O. paid Departmental Dues', amount: '+₦5,000', time: '2 mins ago', ref: 'PAY-A492' },
  { type: 'credit', desc: 'Blessing E. paid Departmental Dues', amount: '+₦10,000', time: '32 mins ago', ref: 'PAY-A491' },
  { type: 'debit', desc: 'Venue deposit — Final Year Dinner', amount: '-₦150,000', time: '3 hrs ago', ref: 'EXP-B034' },
  { type: 'credit', desc: 'Ngozi A. paid Departmental Dues', amount: '+₦5,000', time: '4 hrs ago', ref: 'PAY-A489' },
  { type: 'debit', desc: 'Printing — Study Materials', amount: '-₦50,000', time: 'Yesterday', ref: 'EXP-B033' },
  { type: 'credit', desc: 'Emeka I. paid Departmental Dues', amount: '+₦5,000', time: 'Yesterday', ref: 'PAY-A488' },
]

const MEMBERS = [
  { name: 'Adeola Okonkwo', role: 'Admin', status: 'paid', initials: 'AO' },
  { name: 'Chidi Kamara', role: 'Treasurer', status: 'paid', initials: 'CK' },
  { name: 'Blessing Eze', role: 'Auditor', status: 'paid', initials: 'BE' },
  { name: 'Tunde Adeyemi', role: 'Member', status: 'pending', initials: 'TA' },
  { name: 'Ngozi Anozie', role: 'Member', status: 'paid', initials: 'NA' },
  { name: 'Emeka Ibeji', role: 'Member', status: 'pending', initials: 'EI' },
]

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Wallet, label: 'Collections', id: 'collections' },
  { icon: ClipboardList, label: 'Audit Logs', id: 'audit' },
  { icon: Users, label: 'Members', id: 'members' },
]

type TabId = 'dashboard' | 'collections' | 'audit' | 'members'

export default function DashboardPreview() {
  const [active, setActive] = useState<TabId>('dashboard')
  const [feedItems, setFeedItems] = useState(FEED.slice(0, 3))
  const feedIdxRef = useRef(3)

  useEffect(() => {
    if (active !== 'dashboard') return
    const interval = setInterval(() => {
      const idx = feedIdxRef.current % FEED.length
      feedIdxRef.current += 1
      setFeedItems((prev) => [FEED[idx], ...prev.slice(0, 2)])
    }, 3000)
    return () => clearInterval(interval)
  }, [active])

  return (
    <div className="border-4 border-black neo-shadow-lg bg-surface-container overflow-hidden">
      {/* Window bar */}
      <div className="h-10 bg-black flex items-center px-4 gap-2">
        <div className="w-3 h-3 rounded-full bg-error" />
        <div className="w-3 h-3 rounded-full bg-secondary-container" />
        <div className="w-3 h-3 rounded-full bg-primary-container" />
        <span className="ml-4 text-white/60 text-[11px] font-bold uppercase tracking-widest">
          acafund · treasury dashboard
        </span>
      </div>

      <div className="p-4 md:p-8 bg-white grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[420px]">
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
            {NAV_ITEMS.map(({ icon: Icon, label, id }) => (
              <button
                key={id}
                onClick={() => setActive(id as TabId)}
                className={`flex items-center gap-3 p-3 border-2 transition-all text-left w-full ${
                  active === id
                    ? 'bg-secondary-fixed border-black font-bold'
                    : 'border-transparent hover:border-black hover:bg-surface-container-low'
                }`}
              >
                <Icon size={18} />
                <span className="text-[14px] font-bold">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Main panel */}
        <div className="md:col-span-9 flex flex-col gap-5">

          {/* Dashboard tab */}
          {active === 'dashboard' && (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-[20px] font-bold">Active Collections</h3>
                <span className="bg-tertiary-container border-2 border-black px-3 py-1 text-[11px] font-bold tracking-widest uppercase">
                  3 Active
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {COLLECTIONS.filter(c => c.status === 'Active').map(({ title, pct, color, collected, goal }) => (
                  <div key={title} className="border-2 border-black p-4 neo-shadow hover:bg-surface-container-low transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <p className="text-[14px] font-bold">{title}</p>
                      <span className="text-[12px] font-bold text-on-surface-variant">{pct}%</span>
                    </div>
                    <div className="w-full bg-surface-container border-2 border-black h-3 mb-3">
                      <div className={`${color} h-full border-r-2 border-black transition-all duration-1000`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-[12px] font-bold text-on-surface-variant">
                      <span>{collected} collected</span>
                      <span>Goal: {goal}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-2 border-black p-4 bg-surface-container">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck size={16} className="text-primary" />
                  <span className="text-[12px] font-bold uppercase tracking-widest">Live Activity</span>
                  <span className="ml-auto w-2 h-2 rounded-full bg-primary animate-pulse" />
                </div>
                <div className="flex flex-col gap-2">
                  {feedItems.map((item, i) => (
                    <div key={`${item.name}-${i}`} className="flex justify-between items-center text-[13px] border-b border-black/10 pb-2 last:border-0 last:pb-0">
                      <span>
                        <span className="font-bold">{item.name}</span>{' '}
                        <span className="text-on-surface-variant">{item.action}</span>
                        {item.amount && <span className="font-bold"> {item.amount}</span>}
                      </span>
                      <span className="text-[11px] text-on-surface-variant ml-4 whitespace-nowrap">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Collections tab */}
          {active === 'collections' && (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-[20px] font-bold">All Collections</h3>
                <span className="bg-primary-container border-2 border-black px-3 py-1 text-[11px] font-bold tracking-widest uppercase">
                  {COLLECTIONS.length} Total
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {COLLECTIONS.map(({ title, pct, color, collected, goal, status, members }) => (
                  <div key={title} className="border-2 border-black p-4 neo-shadow bg-white hover:bg-surface-container-low transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-[15px] font-bold">{title}</p>
                        <p className="text-[12px] text-on-surface-variant">{members} members enrolled</p>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 border-2 border-black ${status === 'Active' ? 'bg-primary-container' : 'bg-surface-container'}`}>
                        {status}
                      </span>
                    </div>
                    <div className="w-full bg-surface-container border border-black h-2 mb-2">
                      <div className={`${color} h-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-[12px] font-bold text-on-surface-variant">
                      <span>{collected} collected</span>
                      <span>{pct}% of {goal}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Audit Logs tab */}
          {active === 'audit' && (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-[20px] font-bold">Audit Log</h3>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Live</span>
                </div>
              </div>
              <div className="border-2 border-black overflow-hidden neo-shadow">
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-0 text-[11px] font-bold uppercase tracking-widest bg-surface-container border-b-2 border-black px-4 py-2">
                  <span className="pr-4">Type</span>
                  <span>Description</span>
                  <span className="px-4">Ref</span>
                  <span>Amount</span>
                </div>
                {AUDIT_LOGS.map((log, i) => (
                  <div key={i} className={`grid grid-cols-[auto_1fr_auto_auto] gap-0 px-4 py-3 text-[13px] border-b border-black/10 last:border-0 items-center hover:bg-surface-container-low transition-colors`}>
                    <div className="pr-4">
                      {log.type === 'credit'
                        ? <TrendingUp size={16} className="text-primary" />
                        : <TrendingDown size={16} className="text-error" />
                      }
                    </div>
                    <div>
                      <p className="font-bold text-[13px]">{log.desc}</p>
                      <p className="text-[11px] text-on-surface-variant">{log.time}</p>
                    </div>
                    <span className="px-4 text-[11px] text-on-surface-variant font-mono">{log.ref}</span>
                    <span className={`font-bold text-[14px] ${log.type === 'credit' ? 'text-primary' : 'text-error'}`}>
                      {log.amount}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Members tab */}
          {active === 'members' && (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-[20px] font-bold">Members</h3>
                <div className="flex gap-2">
                  <span className="bg-primary-container border-2 border-black px-2 py-0.5 text-[11px] font-bold">
                    {MEMBERS.filter(m => m.status === 'paid').length} Paid
                  </span>
                  <span className="bg-error/20 border-2 border-black px-2 py-0.5 text-[11px] font-bold">
                    {MEMBERS.filter(m => m.status === 'pending').length} Pending
                  </span>
                </div>
              </div>
              <div className="border-2 border-black neo-shadow overflow-hidden">
                {MEMBERS.map((m, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-black/10 last:border-0 hover:bg-surface-container-low transition-colors">
                    <div className="w-9 h-9 bg-black text-white flex items-center justify-center text-[12px] font-bold flex-shrink-0">
                      {m.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold truncate">{m.name}</p>
                      <p className="text-[12px] text-on-surface-variant">{m.role}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {m.status === 'paid'
                        ? <><CheckCircle2 size={14} className="text-primary" /><span className="text-[12px] font-bold text-primary">Paid</span></>
                        : <><Clock size={14} className="text-on-surface-variant" /><span className="text-[12px] font-bold text-on-surface-variant">Pending</span></>
                      }
                    </div>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.status === 'paid' ? 'bg-primary' : 'bg-error'}`} />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[12px] text-on-surface-variant">
                <AlertCircle size={14} />
                <span>Showing Departmental Dues collection status</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
