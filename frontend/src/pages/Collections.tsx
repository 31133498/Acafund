import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Wallet, RefreshCw } from 'lucide-react'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingState from '../components/ui/LoadingState'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { getCollections, getMembers } from '../lib/api'
import type { Collection, CommunityMember } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'

function fmt(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

const statusColor = (s: string) =>
  s === 'active' ? 'green' : s === 'closed' ? 'gray' : 'yellow'

function deadlineLabel(deadline: string | null) {
  if (!deadline) return null
  const d = new Date(deadline)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const days = Math.ceil(diff / 86400000)
  if (days < 0) return `Ended ${Math.abs(days)}d ago`
  if (days === 0) return 'Ends today'
  return `${days}d left`
}

export default function Collections() {
  const { id } = useParams<{ id: string }>()
  const communityId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [collections, setCollections] = useState<Collection[]>([])
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const myRole = members.find((m) => m.user_id === user?.id)?.role

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [cols, mems] = await Promise.all([
        getCollections(communityId),
        getMembers(communityId),
      ])
      setCollections(cols)
      setMembers(mems)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load collections')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [communityId])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Collections</h1>
          <p className="text-[14px] text-on-surface-variant">{collections.length} collection{collections.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="white" size="sm" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </Button>
          {myRole === 'admin' && (
            <Button size="sm" onClick={() => navigate(`/communities/${communityId}/collections/create`)}>
              <Plus size={14} /> New Collection
            </Button>
          )}
        </div>
      </div>

      {collections.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No collections yet"
          description={myRole === 'admin' ? 'Create your first collection to start collecting dues.' : 'Your admin has not created any collections yet.'}
          action={myRole === 'admin' && (
            <Button size="sm" onClick={() => navigate(`/communities/${communityId}/collections/create`)}>
              <Plus size={14} /> Create Collection
            </Button>
          )}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {collections.map((col) => (
            <button
              key={col.id}
              onClick={() => navigate(`/collections/${col.id}`)}
              className="border-2 border-black bg-white p-5 neo-shadow neo-btn text-left"
            >
              <div className="flex justify-between items-start gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-bold truncate">{col.title}</p>
                  {col.description && (
                    <p className="text-[13px] text-on-surface-variant mt-0.5 line-clamp-1">{col.description}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Badge color={statusColor(col.status) as 'green' | 'gray' | 'yellow'}>{col.status}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-[13px]">
                <span>
                  <span className="font-bold">{fmt(col.amount_per_member)}</span>
                  <span className="text-on-surface-variant"> / member</span>
                </span>
                {col.target_amount && (
                  <span>
                    <span className="text-on-surface-variant">Target: </span>
                    <span className="font-bold">{fmt(col.target_amount)}</span>
                  </span>
                )}
                {col.deadline && (
                  <span className={`font-bold ${new Date(col.deadline) < new Date() ? 'text-error' : 'text-primary'}`}>
                    {deadlineLabel(col.deadline)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
