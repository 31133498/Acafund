import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingState from '../components/ui/LoadingState'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { getLedger } from '../lib/api'
import type { LedgerEntry } from '../lib/types'

function fmt(n: number) { return `₦${Math.abs(n).toLocaleString('en-NG')}` }

interface EntryWithBalance extends LedgerEntry {
  runningBalance: number
}

function computeRunningBalances(entries: LedgerEntry[]): EntryWithBalance[] {
  // entries are newest-first; compute running balance from oldest
  const reversed = [...entries].reverse()
  let balance = 0
  const withBalance = reversed.map((e) => {
    balance += e.type === 'credit' ? e.amount : -e.amount
    return { ...e, runningBalance: balance }
  })
  return withBalance.reverse()
}

export default function Ledger() {
  const { id } = useParams<{ id: string }>()
  const communityId = Number(id)

  const [entries, setEntries] = useState<EntryWithBalance[]>([])
  const [totalBalance, setTotalBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const data = await getLedger(communityId)
      setEntries(computeRunningBalances(data.entries))
      setTotalBalance(data.balance)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load ledger')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [communityId])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Treasury Ledger</h1>
          <p className="text-[14px] text-on-surface-variant">Read-only — full audit trail</p>
        </div>
        <Button variant="white" size="sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      {/* Balance card */}
      <div className="border-4 border-black neo-shadow-lg bg-primary-container p-6">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-on-primary-container/70 mb-1">
          Current Treasury Balance
        </p>
        <p className="text-[40px] font-bold tracking-tight">
          {fmt(totalBalance)}
        </p>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No transactions yet"
          description="Transactions will appear here as members pay and expenses are approved."
        />
      ) : (
        <div className="border-2 border-black bg-white neo-shadow">
          <div className="border-b-2 border-black px-5 py-3 grid grid-cols-12 gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
            <span className="col-span-1">#</span>
            <span className="col-span-4">Description</span>
            <span className="col-span-2 text-right">Amount</span>
            <span className="col-span-2 text-right">Balance</span>
            <span className="col-span-2 text-center">Type</span>
            <span className="col-span-1 text-right">Date</span>
          </div>
          <div className="divide-y-2 divide-black">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className="px-5 py-3 grid grid-cols-12 gap-2 items-center hover:bg-surface-container-low transition-colors"
              >
                <span className="col-span-1 text-[12px] text-on-surface-variant">{entries.length - i}</span>
                <span className="col-span-4 text-[13px] font-bold truncate">{entry.description}</span>
                <span className={`col-span-2 text-right text-[14px] font-bold ${
                  entry.type === 'credit' ? 'text-primary' : 'text-error'
                }`}>
                  {entry.type === 'credit' ? '+' : '-'}{fmt(entry.amount)}
                </span>
                <span className="col-span-2 text-right text-[13px] font-bold">{fmt(entry.runningBalance)}</span>
                <span className="col-span-2 flex justify-center">
                  <Badge color={entry.type === 'credit' ? 'green' : 'red'}>
                    {entry.type === 'credit'
                      ? <><TrendingUp size={10} className="inline mr-1" />In</>
                      : <><TrendingDown size={10} className="inline mr-1" />Out</>
                    }
                  </Badge>
                </span>
                <span className="col-span-1 text-right text-[11px] text-on-surface-variant whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
