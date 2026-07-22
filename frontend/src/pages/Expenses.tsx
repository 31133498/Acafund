import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Receipt, RefreshCw, CheckCircle, XCircle, Clock, Banknote } from 'lucide-react'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingState from '../components/ui/LoadingState'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { getExpenses, getMembers, markExpensePaidOut } from '../lib/api'
import type { Expense, CommunityMember, ExpenseStatus } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'

function fmt(n: number) { return `₦${n.toLocaleString('en-NG')}` }

function statusBadge(s: ExpenseStatus): { color: 'yellow' | 'blue' | 'green' | 'red'; label: string } {
  switch (s) {
    case 'pending':  return { color: 'yellow', label: 'Pending Approval' }
    case 'approved': return { color: 'blue',   label: 'Approved · Payout Pending' }
    case 'paid_out': return { color: 'green',  label: 'Paid Out' }
    case 'rejected': return { color: 'red',    label: 'Rejected' }
  }
}

const StatusIcon = ({ status }: { status: ExpenseStatus }) => {
  if (status === 'paid_out') return <Banknote size={16} className="text-primary" />
  if (status === 'approved') return <CheckCircle size={16} className="text-tertiary" />
  if (status === 'rejected') return <XCircle size={16} className="text-error" />
  return <Clock size={16} className="text-on-surface-variant" />
}

export default function Expenses() {
  const { id } = useParams<{ id: string }>()
  const communityId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Inline payout form state
  const [openPayoutId, setOpenPayoutId] = useState<number | null>(null)
  const [payoutRef, setPayoutRef] = useState('')
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [payoutError, setPayoutError] = useState('')

  const myRole = members.find((m) => m.user_id === user?.id)?.role
  const canMarkPaidOut = myRole === 'admin' || myRole === 'treasurer'

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

  const submitPayout = async (expenseId: number) => {
    if (!payoutRef.trim()) { setPayoutError('Reference is required'); return }
    setPayoutLoading(true); setPayoutError('')
    try {
      const updated = await markExpensePaidOut(expenseId, payoutRef.trim())
      setExpenses((prev) => prev.map((e) => e.id === expenseId ? updated : e))
      setOpenPayoutId(null)
      setPayoutRef('')
    } catch (e: unknown) {
      setPayoutError(e instanceof Error ? e.message : 'Failed to mark paid out')
    } finally { setPayoutLoading(false) }
  }

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
          {expenses.map((exp) => {
            const { color, label } = statusBadge(exp.status)
            const isPayoutOpen = openPayoutId === exp.id
            return (
              <div key={exp.id} className="border-2 border-black bg-white neo-shadow">
                {/* Main row — navigates to detail */}
                <button
                  onClick={() => navigate(`/expenses/${exp.id}?community=${communityId}`)}
                  className="p-4 neo-btn text-left flex items-center justify-between gap-4 w-full"
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
                    <Badge color={color}>{label}</Badge>
                  </div>
                </button>

                {/* Payout prompt — approved + admin/treasurer only */}
                {exp.status === 'approved' && canMarkPaidOut && (
                  <div className="border-t-2 border-black">
                    {isPayoutOpen ? (
                      <div className="p-4 flex flex-col gap-3 bg-surface-container-low">
                        <p className="text-[12px] font-bold uppercase tracking-[0.06em]">
                          Enter bank transfer reference to confirm payout
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <input
                            autoFocus
                            value={payoutRef}
                            onChange={(e) => { setPayoutRef(e.target.value); setPayoutError('') }}
                            placeholder="e.g. TRF20240112ABC"
                            className="flex-1 min-w-0 border-2 border-black px-3 py-2 text-[14px] font-bold bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <Button size="sm" variant="black" loading={payoutLoading} onClick={() => submitPayout(exp.id)}>
                            Confirm
                          </Button>
                          <Button size="sm" variant="white" onClick={() => { setOpenPayoutId(null); setPayoutRef('') }}>
                            Cancel
                          </Button>
                        </div>
                        {payoutError && <p className="text-[12px] text-error font-bold">{payoutError}</p>}
                      </div>
                    ) : (
                      <div className="px-4 py-2.5 flex items-center justify-between gap-4 bg-tertiary-container/30">
                        <p className="text-[12px] text-on-surface-variant">
                          Money sent? Confirm the payout.
                        </p>
                        <Button
                          size="sm"
                          variant="black"
                          onClick={() => { setOpenPayoutId(exp.id); setPayoutRef(''); setPayoutError('') }}
                        >
                          Mark as Paid Out
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Payout proof — paid_out */}
                {exp.status === 'paid_out' && (
                  <div className="border-t-2 border-black px-4 py-2.5 bg-primary-container flex items-center gap-3">
                    <Banknote size={14} className="text-primary flex-shrink-0" />
                    {exp.payout_reference && (
                      <p className="text-[12px] font-bold">Ref: {exp.payout_reference}</p>
                    )}
                    {exp.paid_out_at && (
                      <p className="text-[11px] text-on-surface-variant">
                        · {new Date(exp.paid_out_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
