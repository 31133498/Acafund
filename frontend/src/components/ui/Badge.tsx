type Color = 'green' | 'purple' | 'blue' | 'red' | 'gray' | 'yellow'

interface Props {
  children: React.ReactNode
  color?: Color
}

const colorMap: Record<Color, string> = {
  green:  'bg-primary-container text-on-primary-container',
  purple: 'bg-secondary-fixed text-on-secondary-fixed',
  blue:   'bg-tertiary-container text-on-tertiary-container',
  red:    'bg-error-container text-on-error-container',
  gray:   'bg-surface-container text-on-surface',
  yellow: 'bg-tertiary-fixed text-on-tertiary-fixed',
}

export default function Badge({ children, color = 'gray' }: Props) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 border-2 border-black text-[11px] font-bold tracking-[0.06em] uppercase ${colorMap[color]}`}
    >
      {children}
    </span>
  )
}
