import type { LucideIcon } from 'lucide-react'

interface Props {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      {Icon && (
        <div className="w-16 h-16 border-2 border-black bg-surface-container flex items-center justify-center neo-shadow">
          <Icon size={28} className="text-on-surface-variant" />
        </div>
      )}
      <div>
        <p className="text-[18px] font-bold">{title}</p>
        {description && (
          <p className="text-[14px] text-on-surface-variant mt-1 max-w-xs">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
