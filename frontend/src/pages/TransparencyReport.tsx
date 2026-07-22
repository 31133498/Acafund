import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Shield, Users, Building2, Banknote } from 'lucide-react'
import LoadingState from '../components/ui/LoadingState'
import ErrorState from '../components/ui/ErrorState'
import Badge from '../components/ui/Badge'
import { getTransparencyReport } from '../lib/api'
import type { TransparencyReport as TReport, ExpenseStatus } from '../lib/types'

function fmt(n: number) { return `₦${n.toLocaleString('en-NG')}` }

function expenseBadge(s: ExpenseStatus): { color: 'yellow' | 'blue' | 'green' | 'red'; label: string } {
  switch (s) {
    case 'pending':  return { color: 'yellow', label: 'Pending Approval' }
    case 'approved': return { color: 'blue',   label: 'Approved · Payout Pending' }
    case 'paid_out': return { color: 'green',  label: 'Paid Out' }
    case 'rejected': return { color: 'red',    label: 'Rejected' }
  }
}

export default function TransparencyReport() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const id = Number(collectionId)

  const [report, setReport] = useState<TReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getTransparencyReport(id)
      .then(setReport)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load report'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <LoadingState message="Loading transparency report…" />
    </div>
  )

  if (error || !report) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <ErrorState message={error || 'Report not found'} />
    </div>
  )

  const pct = (report.target_amount ?? 0) > 0
    ? (report.amount_collected / (report.target_amount as number)) * 100
    : 0

  const ra = report.reserved_account

  return (
    <div className="min-h-screen bg-surface">
      {/* Public header */}
      <header className="px-4 md:px-12 py-4 bg-white border-b-4 border-black flex items-center justify-between">
        <span className="text-[22px] font-bold">AcaFund</span>
        <Badge color="green">
          <Shield size={11} className="inline mr-1" />
          Verified Report
        </Badge>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8">
        {/* Title */}
        <div>
          <p className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
            Community Financial Report
          </p>
          <h1 className="text-[32px] font-bold tracking-tight">{report.title ?? 'Collection Report'}</h1>
          {report.description && <p className="text-[15px] text-on-surface-variant mt-2">{report.description}</p>}
        </div>

        {/* Progress */}
        <div className="border-4 border-black neo-shadow-lg bg-primary-container p-6">
          <div className="flex justify-between items-end mb-3">
            <p className="text-[13px] font-bold uppercase tracking-widest text-on-primary-container/70">Funds Collected</p>
            <p className="text-[18px] font-bold">{pct.toFixed(1)}% of target</p>
          </div>
          <div className="w-full bg-black/10 border-2 border-black h-5 mb-4">
            <div className="bg-primary h-full border-r-2 border-black" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-widest text-on-primary-container/70">Collected</p>
              <p className="text-[24px] font-bold">{fmt(report.amount_collected)}</p>
            </div>
            <div>
              <p className="text-[12px] font-bold uppercase tracking-widest text-on-primary-container/70">Target</p>
              <p className="text-[24px] font-bold">{fmt(report.target_amount ?? 0)}</p>
            </div>
          </div>
        </div>

        {/* Reserved account — where funds are held */}
        {ra?.status === 'active' && (
          <div className="border-2 border-black bg-white neo-shadow p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={18} />
              <h2 className="text-[14px] font-bold uppercase tracking-[0.06em]">Funds Held At</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">Bank</p>
                <p className="text-[15px] font-bold">{ra.bank_name}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">Account Number</p>
                <p className="text-[15px] font-bold tracking-[0.06em]">{ra.account_number}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">Account Name</p>
                <p className="text-[15px] font-bold">{ra.account_name}</p>
              </div>
            </div>
          </div>
        )}

        {/* Payment counts — no names exposed */}
        <div className="border-2 border-black bg-white neo-shadow p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} />
            <h2 className="text-[14px] font-bold uppercase tracking-[0.06em]">Member Participation</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary-container border-2 border-black p-4 text-center">
              <p className="text-[32px] font-bold">{report.paid_count}</p>
              <p className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">Paid</p>
            </div>
            <div className="bg-surface-container border-2 border-black p-4 text-center">
              <p className="text-[32px] font-bold">{report.pending_count}</p>
              <p className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">Pending</p>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-on-surface-variant">
            Individual identities are kept private. Only aggregate counts are shown here.
          </p>
        </div>

        {/* Budget allocation */}
        {report.budget_allocation && Object.keys(report.budget_allocation).length > 0 && (
          <div className="border-2 border-black bg-white neo-shadow p-5">
            <h2 className="text-[14px] font-bold uppercase tracking-[0.06em] mb-4">Planned Budget</h2>
            <div className="flex flex-col gap-3">
              {Object.entries(report.budget_allocation).map(([cat, pctVal]) => (
                <div key={cat}>
                  <div className="flex justify-between text-[13px] font-bold mb-1">
                    <span>{cat}</span>
                    <span>{pctVal}%</span>
                  </div>
                  <div className="w-full bg-surface-container border border-black h-2">
                    <div className="bg-secondary h-full" style={{ width: `${pctVal}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked expenses */}
        {report.expenses && report.expenses.length > 0 && (
          <div className="border-2 border-black bg-white neo-shadow">
            <div className="border-b-2 border-black px-5 py-3">
              <h2 className="text-[14px] font-bold uppercase tracking-[0.06em]">Recorded Expenses</h2>
            </div>
            <div className="divide-y-2 divide-black">
              {report.expenses.map((exp, i) => {
                const { color, label } = expenseBadge(exp.status)
                return (
                  <div key={i} className="px-5 py-4 flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold">{exp.title}</p>
                        <p className="text-[12px] text-on-surface-variant">{exp.category}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[15px] font-bold">{fmt(exp.amount)}</p>
                        <Badge color={color}>{label}</Badge>
                      </div>
                    </div>
                    {/* Payout proof — only on paid_out */}
                    {exp.status === 'paid_out' && exp.payout_reference && (
                      <div className="flex items-center gap-2 bg-primary-container border-2 border-black px-3 py-2">
                        <Banknote size={13} className="text-primary flex-shrink-0" />
                        <p className="text-[12px] font-bold">Ref: {exp.payout_reference}</p>
                        {exp.paid_out_at && (
                          <p className="text-[11px] text-on-surface-variant ml-auto">
                            {new Date(exp.paid_out_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <footer className="text-center text-[12px] text-on-surface-variant border-t-2 border-black pt-6">
          This report is publicly accessible and auto-generated by AcaFund.
          <br />Verified financial transparency powered by{' '}
          <span className="font-bold">AcaFund</span>.
        </footer>
      </main>
    </div>
  )
}
