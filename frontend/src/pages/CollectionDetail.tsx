import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Share2, Lock, RefreshCw, CheckCircle, Clock, User, ChevronLeft } from 'lucide-react'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingState from '../components/ui/LoadingState'
import ErrorState from '../components/ui/ErrorState'
import {
  getCollection, getCollectionDashboard, getMyPayment,
  initiatePayment, closeCollection, getMembers,
} from '../lib/api'
import type { CollectionDetail as CollDetailType, CollectionDashboard, CollectionMemberEntry, CommunityMember } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'

function fmt(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>()
  const collectionId = Number(id)
  const { user } = useAuth()
  const navigate = useNavigate()

  const [collection, setCollection] = useState<CollDetailType | null>(null)
  const [dashboard, setDashboard] = useState<CollectionDashboard | null>(null)
  const [myPayment, setMyPayment] = useState<CollectionMemberEntry | null>(null)
  const [communityMembers, setCommunityMembers] = useState<CommunityMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)
  const [closing, setClosing] = useState(false)
  const [actionError, setActionError] = useState('')
  const [copied, setCopied] = useState(false)

  const myRole = communityMembers.find((m) => m.user_id === user?.id)?.role

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const col = await getCollection(collectionId)
      const [dash, pay] = await Promise.all([
        getCollectionDashboard(collectionId),
        getMyPayment(collectionId).catch(() => null),
      ])
      setCollection(col)
      setDashboard(dash)
      setMyPayment(pay)
      // fetch community members to determine role
      const mems = await getMembers(col.community_id).catch(() => [])
      setCommunityMembers(mems)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load collection')
    } finally { setLoading(false) }
  }, [collectionId])

  useEffect(() => { load() }, [load])

  const handlePay = async () => {
    setActionError(''); setPaying(true)
    try {
      const { checkout_url } = await initiatePayment(collectionId)
      sessionStorage.setItem('acafund_payment_collection_id', String(collectionId))
      window.location.href = checkout_url
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Payment initiation failed')
      setPaying(false)
    }
  }

  const handleClose = async () => {
    if (!confirm('Close this collection? No further payments will be accepted.')) return
    setClosing(true); setActionError('')
    try {
      await closeCollection(collectionId)
      await load()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to close collection')
    } finally { setClosing(false) }
  }

  const shareTransparencyLink = () => {
    const url = `${window.location.origin}/report/${collectionId}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <LoadingState />
  if (error || !collection) return <ErrorState message={error} onRetry={load} />

  const pct = dashboard?.percent_target_reached ?? 0

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Back nav */}
      <button
        onClick={() => navigate(`/communities/${collection.community_id}/collections`)}
        className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-on-surface-variant hover:text-primary transition-colors w-fit"
      >
        <ChevronLeft size={14} /> Back to Collections
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Badge color={collection.status === 'active' ? 'green' : 'gray'}>{collection.status}</Badge>
          <h1 className="text-[28px] font-bold tracking-tight mt-2">{collection.title}</h1>
          {collection.description && (
            <p className="text-[14px] text-on-surface-variant mt-1">{collection.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="white" size="sm" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </Button>
          {myRole === 'admin' && (
            <Button variant="white" size="sm" onClick={shareTransparencyLink}>
              <Share2 size={13} />
              {copied ? 'Link Copied!' : 'Share Report'}
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="border-2 border-error bg-error-container p-3 text-[13px] font-bold text-error">{actionError}</div>
      )}

      {/* Pay now CTA */}
      {myPayment?.status === 'pending' && collection.status === 'active' && (
        <div className="border-4 border-black neo-shadow-lg bg-primary-container p-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-widest text-on-primary-container/70">Your dues</p>
            <p className="text-[24px] font-bold">{fmt(myPayment.amount_due)}</p>
            <p className="text-[13px] text-on-primary-container/70">Status: <strong>Pending</strong></p>
          </div>
          <Button variant="black" size="lg" loading={paying} onClick={handlePay}>
            Pay Now
          </Button>
        </div>
      )}

      {myPayment?.status === 'paid' && (
        <div className="border-2 border-primary bg-primary-container/30 p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-primary" />
          <p className="text-[14px] font-bold text-primary">
            You've paid {fmt(myPayment.amount_due)} — thank you!
          </p>
        </div>
      )}

      {/* Progress */}
      {dashboard && (
        <div className="border-2 border-black bg-white p-6 neo-shadow">
          <div className="flex justify-between items-end mb-3">
            <p className="text-[14px] font-bold uppercase tracking-[0.06em]">Collection Progress</p>
            <p className="text-[22px] font-bold">{pct.toFixed(1)}%</p>
          </div>
          <div className="w-full bg-surface-container border-2 border-black h-5 mb-4">
            <div
              className="bg-primary h-full border-r-2 border-black transition-all duration-700"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Collected', value: fmt(dashboard.amount_collected), color: 'text-primary' },
              { label: 'Outstanding', value: fmt(dashboard.amount_outstanding), color: 'text-error' },
              { label: 'Paid', value: `${dashboard.paid_count} members`, color: 'text-on-surface' },
              { label: 'Pending', value: `${dashboard.pending_count} members`, color: 'text-on-surface' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant mb-0.5">{label}</p>
                <p className={`text-[16px] font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget allocation */}
      {collection.budget_allocation && Object.keys(collection.budget_allocation).length > 0 && (
        <div className="border-2 border-black bg-white p-5 neo-shadow">
          <h2 className="text-[14px] font-bold uppercase tracking-[0.06em] mb-4">Budget Allocation</h2>
          <div className="flex flex-col gap-3">
            {Object.entries(collection.budget_allocation).map(([cat, pct]) => (
              <div key={cat}>
                <div className="flex justify-between text-[13px] font-bold mb-1">
                  <span>{cat}</span>
                  <span>{pct}%</span>
                </div>
                <div className="w-full bg-surface-container border border-black h-2">
                  <div className="bg-secondary h-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member payment list */}
      <div className="border-2 border-black bg-white neo-shadow">
        <div className="border-b-2 border-black px-5 py-3 flex items-center justify-between">
          <h2 className="text-[14px] font-bold uppercase tracking-[0.06em]">Member Payments</h2>
          <span className="text-[12px] text-on-surface-variant">{collection.members.length} enrolled</span>
        </div>
        <div className="divide-y-2 divide-black">
          {collection.members.map((m) => (
            <div key={m.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {m.status === 'paid'
                  ? <CheckCircle size={16} className="text-primary" />
                  : <Clock size={16} className="text-on-surface-variant" />
                }
                <div>
                  <p className="text-[13px] font-bold flex items-center gap-1">
                    <User size={12} /> User #{m.user_id}
                    {m.user_id === user?.id && <span className="text-on-surface-variant font-normal">(you)</span>}
                  </p>
                  {m.paid_at && (
                    <p className="text-[11px] text-on-surface-variant">
                      {new Date(m.paid_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-bold">{fmt(m.amount_due)}</p>
                <Badge color={m.status === 'paid' ? 'green' : m.status === 'waived' ? 'blue' : 'gray'}>
                  {m.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Admin actions */}
      {myRole === 'admin' && collection.status === 'active' && (
        <div className="border-2 border-black p-4 bg-surface-container flex items-center justify-between gap-4">
          <p className="text-[13px] text-on-surface-variant">Close this collection to prevent further payments.</p>
          <Button variant="danger" size="sm" loading={closing} onClick={handleClose}>
            <Lock size={13} /> Close Collection
          </Button>
        </div>
      )}
    </div>
  )
}
