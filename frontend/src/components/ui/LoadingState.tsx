export default function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 border-4 border-black border-t-primary rounded-full animate-spin" />
      <p className="text-[13px] font-bold uppercase tracking-widest text-on-surface-variant">{message}</p>
    </div>
  )
}
