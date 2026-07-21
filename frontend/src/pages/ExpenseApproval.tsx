import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingState from '../components/ui/LoadingState'
import ErrorState from '../components/ui/ErrorState'
import { getExpenses, approveExpense, rejectExpense, getMembers } from '../lib/api'
import type { Expense, CommunityMember } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'

function fmt(n: number) { return `₦${n.toLocaleString('en-NG')}` }

export default function ExpenseApproval() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const expenseId = Number(id)
  const communityId = Number(searchParams.get('community'))
  const navigate = useNavigate()
  const { user } = useAuth()

  const [expense, setExpense] = useState<Expense | null>(null)
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')
  const [actionError, setActionError] = useState('')

  const myRole = members.find((m) => m.user_id === user?.id)?.role

  useEffect(() => {
    if (!communityId) {
      setError('Community context missing. Navigate here from the Expenses list.')
      setLoading(false)
      return
    }
    const load = async () => {
      setLoading(true)
      try {
        const [exps, mems] = await Promise.all([
          getExpenses(communityId),
          getMembers(communityId),
        ])
        const found = exps.find((e) => e.id === expenseId)
        if (found) setExpense(found)
        else setError('Expense not found in this community.')
        setMembers(mems)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load expense')
      } finally { setLoading(false) }
    }
    load()
  }, [expenseId, communityId])

  const handleApprove = async (e: FormEvent) => {
    e.preventDefault()
    setApproving(true); setActionError('')
    try {
      await approveExpense(expenseId, note.trim() || undefined)
      navigate(-1)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval failed'
      setActionError(
        msg.toLowerCase().includes('own')
          ? 'You cannot approve your own expense request.'
          : msg,
      )
    } finally { setApproving(false) }
  }

  const handleReject = async (e: FormEvent) => {
    e.preventDefault()
    if (!note.trim()) { setNoteError('A reason is required when rejecting.'); return }
    setNoteError(''); setRejecting(true); setActionError('')
    try {
      await rejectExpense(expenseId, note.trim())
      navigate(-1)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Rejection failed')
    } finally { setRejecting(false) }
  }

  if (loading) return <LoadingState />
  if (error || !expense) return <ErrorState message={error} />

  const isActionable = myRole === 'auditor' && expense.status === 'pending'

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-6">
      <div>
        <Badge color={expense.status === 'approved' ? 'green' : expense.status === 'rejected' ? 'red' : 'yellow'}>
          {expense.status}
        </Badge>
        <h1 className="text-[28px] font-bold tracking-tight mt-2">{expense.title}</h1>
      </div>

      {actionError && (
        <div className="border-2 border-error bg-error-container p-3 text-[13px] font-bold text-error">{actionError}</div>
      )}

      {/* Detail card */}
      <div className="border-2 border-black bg-white p-6 neo-shadow flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">Amount</p>
            <p className="text-[24px] font-bold">{fmt(expense.amount)}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">Category</p>
            <p className="text-[16px] font-bold">{expense.category}</p>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">Requested by</p>
          <p className="text-[14px]">User #{expense.created_by}</p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">Date</p>
          <p className="text-[14px]">{new Date(expense.created_at).toLocaleString()}</p>
        </div>

        {expense.receipt_url && (
          <a
            href={expense.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[13px] font-bold text-primary hover:underline"
          >
            <ExternalLink size={14} /> View Receipt
          </a>
        )}

        {expense.notes && (
          <div className="border-2 border-black bg-surface-container p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant mb-1">Notes</p>
            <p className="text-[14px]">{expense.notes}</p>
          </div>
        )}
      </div>

      {/* Approval actions — auditor only */}
      {isActionable && (
        <div className="border-2 border-black bg-white p-5 neo-shadow flex flex-col gap-4">
          <h2 className="text-[14px] font-bold uppercase tracking-[0.06em]">Your Decision</h2>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold uppercase tracking-[0.08em]">
              Note{' '}
              <span className="text-on-surface-variant font-normal normal-case tracking-normal">
                (required to reject)
              </span>
            </label>
            <textarea
              rows={3}
              placeholder="Optional note for approval; required for rejection…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="border-2 border-black bg-white px-4 py-3 text-[15px] font-sans focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            {noteError && <p className="text-[12px] text-error font-bold">{noteError}</p>}
          </div>

          <div className="flex gap-3">
            <Button
              variant="primary"
              fullWidth
              loading={approving}
              onClick={handleApprove as unknown as React.MouseEventHandler<HTMLButtonElement>}
            >
              <CheckCircle size={15} /> Approve
            </Button>
            <Button
              variant="danger"
              fullWidth
              loading={rejecting}
              onClick={handleReject as unknown as React.MouseEventHandler<HTMLButtonElement>}
            >
              <XCircle size={15} /> Reject
            </Button>
          </div>
        </div>
      )}

      {!isActionable && expense.status === 'pending' && (
        <p className="text-[13px] text-on-surface-variant text-center">
          Only auditors can approve or reject this expense.
        </p>
      )}
    </div>
  )
}
