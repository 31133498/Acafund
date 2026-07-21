import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Wallet, Users, Receipt, BookOpen, TrendingUp, RefreshCw, Copy, Check } from 'lucide-react'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingState from '../components/ui/LoadingState'
import ErrorState from '../components/ui/ErrorState'
import { getCommunity, getMembers, getCollections } from '../lib/api'
import type { Community, CommunityMember, Collection } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'

function fmt(n: number) {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`
}

export default function CommunityHome() {
  const { id } = useParams<{ id: string }>()
  const communityId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [community, setCommunity] = useState<Community | null>(null)
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const myRole = members.find((m) => m.user_id === user?.id)?.role

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [c, mems, cols] = await Promise.all([
        getCommunity(communityId),
        getMembers(communityId),
        getCollections(communityId),
      ])
      setCommunity(c)
      setMembers(mems)
      setCollections(cols)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [communityId])

  const copyCode = () => {
    if (!community) return
    navigator.clipboard.writeText(community.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <LoadingState />
  if (error || !community) return <ErrorState message={error} onRetry={load} />

  const activeCollections = collections.filter((c) => c.status === 'active')

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Community</p>
          <h1 className="text-[32px] font-bold tracking-tight">{community.name}</h1>
          {community.description && (
            <p className="text-[15px] text-on-surface-variant mt-1">{community.description}</p>
          )}
          {myRole && (
            <Badge color={myRole === 'admin' ? 'green' : myRole === 'treasurer' ? 'blue' : myRole === 'auditor' ? 'yellow' : 'gray'} >
              {myRole}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="white" size="sm" onClick={load}>
            <RefreshCw size={13} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Invite code (admin only) */}
      {myRole === 'admin' && (
        <div className="border-2 border-black bg-secondary-fixed p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">Invite Code</p>
            <p className="text-[20px] font-bold tracking-[0.15em]">{community.invite_code}</p>
          </div>
          <button
            onClick={copyCode}
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-[12px] font-bold uppercase tracking-widest neo-shadow-sm neo-btn bg-white"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Members', value: members.length, icon: Users, color: 'bg-primary-container' },
          { label: 'Active Collections', value: activeCollections.length, icon: Wallet, color: 'bg-secondary-fixed' },
          { label: 'Total Collections', value: collections.length, icon: TrendingUp, color: 'bg-tertiary-container' },
          { label: 'Your Role', value: myRole?.toUpperCase() ?? '—', icon: Users, color: 'bg-surface-container' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`${color} border-2 border-black neo-shadow p-4`}>
            <Icon size={18} className="mb-2 text-on-surface-variant" />
            <p className="text-[22px] font-bold leading-none">{value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick nav */}
      <div>
        <h2 className="text-[14px] font-bold uppercase tracking-[0.08em] text-on-surface-variant mb-4">Navigate</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { icon: Users, label: 'Members', to: `/communities/${communityId}/members` },
            { icon: Wallet, label: 'Collections', to: `/communities/${communityId}/collections` },
            { icon: Receipt, label: 'Expenses', to: `/communities/${communityId}/expenses` },
            { icon: BookOpen, label: 'Ledger', to: `/communities/${communityId}/ledger` },
          ].map(({ icon: Icon, label, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className="border-2 border-black bg-white p-4 neo-shadow neo-btn text-left flex items-center gap-3 hover:bg-surface-container-low"
            >
              <Icon size={18} className="text-primary" />
              <span className="text-[14px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active collections preview */}
      {activeCollections.length > 0 && (
        <div>
          <h2 className="text-[14px] font-bold uppercase tracking-[0.08em] text-on-surface-variant mb-4">
            Active Collections
          </h2>
          <div className="flex flex-col gap-3">
            {activeCollections.slice(0, 3).map((col) => (
              <button
                key={col.id}
                onClick={() => navigate(`/collections/${col.id}`)}
                className="border-2 border-black bg-white p-4 neo-shadow neo-btn text-left flex justify-between items-center"
              >
                <div>
                  <p className="text-[15px] font-bold">{col.title}</p>
                  <p className="text-[13px] text-on-surface-variant">
                    {col.target_amount ? fmt(col.target_amount) : `${fmt(col.amount_per_member)} / member`}
                  </p>
                </div>
                <Badge color="green">Active</Badge>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
