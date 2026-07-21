import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlayCircle } from 'lucide-react'
import DashboardPreview from './DashboardPreview'

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    el.classList.add('opacity-0', 'translate-y-6')
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease'
      el.classList.remove('opacity-0', 'translate-y-6')
    })
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative px-4 md:px-12 py-16 md:py-24 flex flex-col items-center text-center bg-white overflow-hidden"
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none" aria-hidden>
        <div className="absolute top-10 left-10 w-32 h-32 bg-secondary border-4 border-black rotate-12" />
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-tertiary-fixed-dim border-4 border-black -rotate-6" />
        <div className="absolute top-40 right-20 w-16 h-16 bg-primary-container border-4 border-black rotate-45" />
      </div>

      <div className="z-10 max-w-4xl">
        <div className="inline-flex items-center gap-2 bg-black text-white px-4 py-1.5 mb-6 text-[12px] font-bold tracking-[0.1em] uppercase">
          <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
          Now in Beta — Free for Student Chapters
        </div>

        <h1 className="text-[clamp(36px,7vw,64px)] leading-[1.1] tracking-[-0.02em] font-bold mb-6">
          Collect Together. <br />
          <span className="bg-primary-container px-4 border-2 border-black inline-block mt-1">
            Spend Transparently.
          </span>
        </h1>

        <p className="text-[18px] leading-[1.6] text-on-surface-variant mb-10 max-w-2xl mx-auto">
          The financial operating system for African student communities. Collect, verify, govern,
          and report on every naira your class ever touches.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/register')}
            className="bg-primary-container text-on-primary-container border-4 border-black neo-shadow-lg neo-btn-lg px-8 py-4 text-[14px] font-bold tracking-[0.05em] uppercase text-lg"
          >
            Get Started for Free
          </button>
          <a
            href="#features"
            className="bg-white text-black border-4 border-black neo-shadow-lg neo-btn-lg px-8 py-4 text-[14px] font-bold tracking-[0.05em] uppercase text-lg flex items-center justify-center gap-2"
          >
            <PlayCircle size={18} />
            See How It Works
          </a>
        </div>

        <p className="mt-6 text-[12px] text-on-surface-variant font-bold tracking-widest uppercase">
          Trusted by 500+ chapters across Nigeria · No credit card required
        </p>
      </div>

      <div className="mt-20 w-full max-w-6xl mx-auto">
        <DashboardPreview />
      </div>
    </section>
  )
}
