interface Props {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'white'
}

export default function Logo({ size = 'md', variant = 'default' }: Props) {
  const sizes = {
    sm:  { box: 'w-6 h-6 text-[11px]',  word: 'text-[15px]', gap: 'gap-1.5' },
    md:  { box: 'w-8 h-8 text-[14px]',  word: 'text-[20px]', gap: 'gap-2' },
    lg:  { box: 'w-10 h-10 text-[17px]', word: 'text-[26px]', gap: 'gap-2.5' },
  }
  const s = sizes[size]
  const isWhite = variant === 'white'

  return (
    <div className={`flex items-center ${s.gap} select-none`}>
      {/* logomark: bold "A" in a green-bordered square */}
      <div
        className={`${s.box} flex-shrink-0 border-2 flex items-center justify-center font-black leading-none ${
          isWhite
            ? 'bg-white border-white text-black'
            : 'bg-primary border-black text-white'
        }`}
      >
        A
      </div>
      {/* wordmark */}
      <span
        className={`font-bold tracking-tight leading-none ${s.word} ${
          isWhite ? 'text-white' : 'text-on-surface'
        }`}
      >
        Aca<span className={isWhite ? 'text-primary-container' : 'text-primary'}>Fund</span>
      </span>
    </div>
  )
}
