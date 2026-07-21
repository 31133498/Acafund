import { useEffect, useRef, useState } from 'react'

function useCountUp(target: number, active: boolean, duration = 1800) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) return
    const start = Date.now()
    const frame = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }, [active, target, duration])
  return value
}

const STATS = [
  { value: 500, suffix: '+', label: 'Student Chapters', color: 'text-primary-container' },
  { value: 250, prefix: '₦', suffix: 'M+', label: 'Funds Tracked', color: 'text-secondary-fixed' },
  { value: 0, suffix: '', label: 'Embezzlement Cases', color: 'text-tertiary-fixed-dim' },
]

function StatItem({ value, prefix, suffix, label, color, active }: typeof STATS[0] & { active: boolean }) {
  const count = useCountUp(value, active)
  return (
    <div className="text-center">
      <p className={`text-[clamp(48px,8vw,64px)] leading-[1.1] tracking-[-0.02em] font-bold ${color} mb-2`}>
        {prefix}{count}{suffix}
      </p>
      <p className="text-[14px] font-bold tracking-widest uppercase text-white/70">{label}</p>
    </div>
  )
}

export default function Stats() {
  const ref = useRef<HTMLElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setActive(true) },
      { threshold: 0.3 },
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className="py-20 bg-black text-white">
      <div className="px-4 md:px-12 grid grid-cols-1 md:grid-cols-3 gap-12">
        {STATS.map((s) => (
          <StatItem key={s.label} {...s} active={active} />
        ))}
      </div>
    </section>
  )
}
