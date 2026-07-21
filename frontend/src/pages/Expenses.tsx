import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Receipt, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingState from '../components/ui/LoadingState'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { getExpenses, getMembers } from '../lib/api'
import type { Expense, CommunityMember } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'

function fmt(n: number) { return `₦${n.toLocaleString('en-NG')}` }

const statusColor = (s: string) =>
  s === 'approved' ? 'green' : s === 'rejected' ? 'red' : 'yellow'

const StatusIcon = ({ status }: { status: string }) =>
  status === 'approved' ? <CheckCircle size={16} className="text-primary" />
  : status === 'rejected' ? <XCircle size={16} className="text-error" />
  : <Clock size={16} className="text-on-surface-variant" />

export default function Expenses() {
  const { id } = useParams<{ id: string }>()
  const communityId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const myRole = members.find((m) => m.user_id === user?.id)?.role

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [exps, mems] = await Promise.all([
        getExpenses(communityId),
        getMembers(communityId),
      ])
      setExpenses(exps)
      setMembers(mems)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load expenses')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [communityId])

  const pendingExpenses = expenses.filter((e) => e.status === 'pending')

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Expenses</h1>
          <p className="text-[14px] text-on-surface-variant">
            {pendingExpenses.length} pending approval
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="white" size="sm" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </Button>
          {myRole === 'treasurer' && (
            <Button size="sm" onClick={() => navigate(`/communities/${communityId}/expenses/create`)}>
              <Plus size={14} /> New Request
            </Button>
          )}
        </div>
      </div>

      {/* Auditor — pending approval queue */}
      {myRole === 'auditor' && pendingExpenses.length > 0 && (
        <div className="border-2 border-black bg-tertiary-container p-4">
          <p className="text-[13px] font-bold mb-3">
            {pendingExpenses.length} expense{pendingExpenses.length !== 1 ? 's' : ''} awaiting your approval
          </p>
          <div className="flex flex-col gap-2">
            {pendingExpenses.map((exp) => (
              <button
                key={exp.id}
                onClick={() => navigate(`/expenses/${exp.id}?community=${communityId}`)}
                className="border-2 border-black bg-white p-3 flex justify-between items-center neo-shadow-sm neo-btn text-left"
              >
                <span className="text-[14px] font-bold">{exp.title}</span>
                <span className="flex items-center gap-2 text-[13px] font-bold">
                  {fmt(exp.amount)}
                  <Badge color="yellow">Review</Badge>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses yet"
          description={myRole === 'treasurer' ? 'Submit a new expense request to get started.' : 'No expense requests have been submitted.'}
          action={myRole === 'treasurer' && (
            <Button size="sm" onClick={() => navigate(`/communities/${communityId}/expenses/create`)}>
              <Plus size={14} /> New Expense
            </Button>
          )}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {expenses.map((exp) => (
            <button
              key={exp.id}
              onClick={() => navigate(`/expenses/${exp.id}?community=${communityId}`)}
              className="border-2 border-black bg-white p-4 neo-shadow neo-btn text-left flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <StatusIcon status={exp.status} />
                <div className="min-w-0">
                  <p className="text-[15px] font-bold truncate">{exp.title}</p>
                  <p className="text-[12px] text-on-surface-variant">{exp.category}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[15px] font-bold">{fmt(exp.amount)}</p>
                <Badge color={statusColor(exp.status) as 'green' | 'red' | 'yellow'}>{exp.status}</Badge>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
