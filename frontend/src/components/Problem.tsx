export default function Problem() {
  return (
    <section className="px-4 md:px-12 py-24 bg-black text-white">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div>
          <div className="inline-block bg-primary border-2 border-white/20 text-white text-[11px] font-bold tracking-[0.15em] uppercase px-3 py-1 mb-8">
            The Problem
          </div>
          <h2 className="text-[clamp(36px,5vw,56px)] leading-[1.1] font-bold mb-6">
            Money moves digitally.<br />
            <span className="text-primary-container">Accountability stays manual.</span>
          </h2>
          <p className="text-[16px] text-white/70 leading-[1.7] mb-8">
            Every Nigerian student has lived this. The class rep shares a bank account.
            Screenshots flood WhatsApp. Trust becomes the infrastructure. The rep becomes
            the cashier, accountant, auditor, and defendant — all unpaid, all inside a group chat.
          </p>
          <blockquote className="border-l-4 border-primary-container pl-5 text-[15px] italic text-white/60 leading-relaxed">
            "The problem is not that students refuse to pay. The problem is that the
            infrastructure around collection is broken."
          </blockquote>
        </div>

        {/* WhatsApp mock */}
        <div className="bg-[#111] border-2 border-white/10 rounded-none overflow-hidden">
          <div className="bg-[#1a1a1a] px-4 py-3 text-[11px] font-bold tracking-widest uppercase text-white/40 border-b border-white/10">
            STATS 200 DEPARTMENTAL · WHATSAPP GROUP · 234 MEMBERS
          </div>
          <div className="p-5 flex flex-col gap-4">
            {[
              { sender: 'Class Rep', msg: 'Everyone should pay ₦5,000 before Friday. Send receipt here.', highlight: true },
              { sender: 'Tolu', msg: 'Done. Please confirm.', highlight: false },
              { sender: 'Amaka', msg: 'I paid yesterday, why is my name not on the list?', highlight: false },
              { sender: 'Seun', msg: 'Who has paid so far? Can someone post the list?', highlight: false },
              { sender: 'Class Rep', msg: 'Please give me time to verify everything. I have 87 screenshots.', highlight: true },
              { sender: 'Unknown', msg: 'Oga where did the ₦200k go from last collection?', highlight: false },
            ].map(({ sender, msg, highlight }, i) => (
              <div key={i} className="flex gap-3 text-[13px]">
                <span className={`font-bold shrink-0 ${highlight ? 'text-primary-container' : 'text-white/50'}`}>
                  {sender}
                </span>
                <span className="text-white/70 leading-relaxed">{msg}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-error/80">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
              87 UNVERIFIED SCREENSHOTS
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
