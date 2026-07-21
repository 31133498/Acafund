import { AlertTriangle, RefreshCw } from 'lucide-react'
import Button from './Button'

interface Props {
  message?: string
  onRetry?: () => void
}

export default function ErrorState({ message = 'Something went wrong.', onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 border-2 border-black bg-error-container flex items-center justify-center neo-shadow">
        <AlertTriangle size={28} className="text-error" />
      </div>
      <div>
        <p className="text-[18px] font-bold text-error">Error</p>
        <p className="text-[14px] text-on-surface-variant mt-1 max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <Button variant="white" size="sm" onClick={onRetry}>
          <RefreshCw size={14} />
          Try Again
        </Button>
      )}
    </div>
  )
}
