import { PlusCircle, Megaphone, Vote, ReceiptText, type LucideIcon } from 'lucide-react'

interface Step {
  num: string
  icon: LucideIcon
  title: string
  desc: string
  color: string
}

const STEPS: Step[] = [
  {
    num: '01',
    icon: PlusCircle,
    title: 'Create a Chapter',
    desc: 'Register your student association in 2 minutes. Set up admin roles and invite your treasurer.',
    color: 'bg-primary-container',
  },
  {
    num: '02',
    icon: Megaphone,
    title: 'Launch a Collection',
    desc: "Define what you're collecting for, set a target, and share a payment link with your class.",
    color: 'bg-secondary-fixed',
  },
  {
    num: '03',
    icon: Vote,
    title: 'Vote on Spending',
    desc: 'Before money moves, the community votes. Majority approval required for every expense.',
    color: 'bg-tertiary-container',
  },
  {
    num: '04',
    icon: ReceiptText,
    title: 'Publish the Report',
    desc: 'At end of semester, generate and share a verified financial report — one click.',
    color: 'bg-surface-container-high',
  },
]

export default function HowItWorks() {
  return (
    <section id="dashboard" className="px-4 md:px-12 py-20 bg-white">
      <div className="mb-16 text-center">
        <h2 className="text-[40px] leading-[1.2] tracking-[-0.01em] font-bold">How It Works</h2>
        <p className="text-on-surface-variant text-[18px] mt-4 max-w-xl mx-auto">
          From zero to a fully transparent chapter treasury in under 5 minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {STEPS.map(({ num, icon: Icon, title, desc, color }, i) => (
          <div key={num} className="relative">
            {i < STEPS.length - 1 && (
              <div className="hidden md:block absolute top-10 left-[calc(100%+0px)] w-full h-0.5 bg-black z-10" />
            )}
            <div className={`${color} border-4 border-black neo-shadow-lg p-6 h-full flex flex-col gap-4`}>
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 bg-black flex items-center justify-center">
                  <Icon size={20} className="text-white" />
                </div>
                <span className="text-[48px] font-bold text-black/10 leading-none">{num}</span>
              </div>
              <h3 className="text-[18px] font-bold">{title}</h3>
              <p className="text-[14px] text-on-surface-variant leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
