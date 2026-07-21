import { useNavigate } from 'react-router-dom'

export default function CTA() {
  const navigate = useNavigate()

  return (
    <section id="about" className="px-4 md:px-12 py-24 bg-white">
      <div className="bg-primary-container border-4 border-black neo-shadow-lg p-12 md:p-20 text-center relative overflow-hidden">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-secondary opacity-20 rotate-45 pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-tertiary opacity-20 -rotate-12 pointer-events-none" />

        <div className="relative z-10">
          <span className="inline-block bg-black text-white text-[12px] font-bold tracking-[0.1em] uppercase px-4 py-1.5 mb-6">
            Zero-Risk Guarantee
          </span>

          <h2 className="text-[clamp(28px,5vw,56px)] leading-[1.15] font-bold mb-4">
            Ready to clean up <br /> your community finances?
          </h2>
          <p className="text-[16px] text-on-primary-container/80 mb-10 max-w-lg mx-auto">
            Join 500+ student chapters already running transparent treasuries on AcaFund.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/register')}
              className="bg-black text-white border-2 border-black neo-shadow neo-btn px-10 py-5 text-[14px] font-bold tracking-[0.05em] uppercase text-xl"
            >
              Create Admin Account
            </button>
            <button
              onClick={() => navigate('/login')}
              className="bg-white text-black border-2 border-black neo-shadow neo-btn px-10 py-5 text-[14px] font-bold tracking-[0.05em] uppercase text-xl"
            >
              Sign In
            </button>
          </div>

          <p className="mt-8 text-[12px] font-bold tracking-widest uppercase text-on-primary-container/70">
            No credit card required · Start in 2 minutes · Cancel anytime
          </p>
        </div>
      </div>
    </section>
  )
}
