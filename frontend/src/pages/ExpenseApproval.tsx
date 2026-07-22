import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ExternalLink, CheckCircle, XCircle, Banknote, Building2 } from 'lucide-react'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingState from '../components/ui/LoadingState'
import ErrorState from '../components/ui/ErrorState'
import { getExpenses, approveExpense, rejectExpense, getMembers, markExpensePaidOut } from '../lib/api'
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

export default function ExpenseApproval() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const expenseId = Number(id)
  const communityId = Number(searchParams.get('community'))
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

  // Payout form state
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [payoutRef, setPayoutRef] = useState('')
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [payoutError, setPayoutError] = useState('')

  const myRole = members.find((m) => m.user_id === user?.id)?.role
  const canMarkPaidOut = myRole === 'admin' || myRole === 'treasurer'

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
      const updated = await approveExpense(expenseId, note.trim() || undefined)
      setExpense(updated)
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
      const updated = await rejectExpense(expenseId, note.trim())
      setExpense(updated)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Rejection failed')
    } finally { setRejecting(false) }
  }

  const handlePayout = async () => {
    if (!payoutRef.trim()) { setPayoutError('Reference is required'); return }
    setPayoutLoading(true); setPayoutError('')
    try {
      const updated = await markExpensePaidOut(expenseId, payoutRef.trim())
      setExpense(updated)
      setPayoutOpen(false)
      setPayoutRef('')
    } catch (err: unknown) {
      setPayoutError(err instanceof Error ? err.message : 'Failed to mark paid out')
    } finally { setPayoutLoading(false) }
  }

  if (loading) return <LoadingState />
  if (error || !expense) return <ErrorState message={error} />

  const { color, label } = statusBadge(expense.status)
  const isActionable = myRole === 'auditor' && expense.status === 'pending'

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-6">
      <div>
        <Badge color={color}>{label}</Badge>
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
          <p className="text-[14px]">User #{expense.requested_by}</p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">Date</p>
          <p className="text-[14px]">{new Date(expense.created_at).toLocaleString()}</p>
        </div>

        {/* Destination account */}
        {(expense.destination_bank_name || expense.destination_account_number) && (
          <div className="border-2 border-black bg-surface-container p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={14} className="text-on-surface-variant" />
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">Where to Send</p>
            </div>
            {expense.destination_bank_name && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">Bank</p>
                <p className="text-[14px] font-bold">{expense.destination_bank_name}</p>
              </div>
            )}
            {expense.destination_account_number && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">Account Number</p>
                <p className="text-[16px] font-bold tracking-[0.06em]">{expense.destination_account_number}</p>
              </div>
            )}
            {expense.destination_account_name && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">Account Name</p>
                <p className="text-[14px] font-bold">{expense.destination_account_name}</p>
              </div>
            )}
          </div>
        )}

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

        {expense.decision_note && (
          <div className="border-2 border-black bg-surface-container p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant mb-1">Notes</p>
            <p className="text-[14px]">{expense.decision_note}</p>
          </div>
        )}
      </div>

      {/* Paid out proof */}
      {expense.status === 'paid_out' && (
        <div className="border-2 border-black bg-primary-container p-4 flex items-center gap-3">
          <Banknote size={16} className="text-primary flex-shrink-0" />
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-on-surface-variant">Payout Confirmed</p>
            {expense.payout_reference && (
              <p className="text-[14px] font-bold">Ref: {expense.payout_reference}</p>
            )}
            {expense.paid_out_at && (
              <p className="text-[12px] text-on-surface-variant">
                {new Date(expense.paid_out_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Mark as Paid Out — admin/treasurer when approved */}
      {expense.status === 'approved' && canMarkPaidOut && (
        <div className="border-2 border-black bg-white neo-shadow">
          {payoutOpen ? (
            <div className="p-5 flex flex-col gap-3">
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
                <Button size="sm" variant="black" loading={payoutLoading} onClick={handlePayout}>
                  Confirm
                </Button>
                <Button size="sm" variant="white" onClick={() => { setPayoutOpen(false); setPayoutRef('') }}>
                  Cancel
                </Button>
              </div>
              {payoutError && <p className="text-[12px] text-error font-bold">{payoutError}</p>}
            </div>
          ) : (
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[14px] font-bold">Ready to pay out?</p>
                <p className="text-[12px] text-on-surface-variant mt-0.5">
                  Transfer the money, then confirm with a reference.
                </p>
              </div>
              <Button
                size="sm"
                variant="black"
                onClick={() => { setPayoutOpen(true); setPayoutError('') }}
              >
                Mark as Paid Out
              </Button>
            </div>
          )}
        </div>
      )}

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
