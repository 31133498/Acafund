import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { User, RefreshCw } from 'lucide-react'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingState from '../components/ui/LoadingState'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { getMembers, changeMemberRole } from '../lib/api'
import type { CommunityMember, MemberRole } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'

const ROLES: MemberRole[] = ['admin', 'treasurer', 'auditor', 'member']

const roleBadgeColor = (r: MemberRole) =>
  r === 'admin' ? 'green' : r === 'treasurer' ? 'blue' : r === 'auditor' ? 'yellow' : 'gray'

export default function Members() {
  const { id } = useParams<{ id: string }>()
  const communityId = Number(id)
  const { user } = useAuth()

  const [members, setMembers] = useState<CommunityMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [changing, setChanging] = useState<number | null>(null)
  const [roleError, setRoleError] = useState<Record<number, string>>({})

  const myRole = members.find((m) => m.user_id === user?.id)?.role
  const isAdmin = myRole === 'admin'

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setMembers(await getMembers(communityId))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [communityId])

  const handleRoleChange = async (userId: number, newRole: MemberRole) => {
    setChanging(userId)
    setRoleError((prev) => ({ ...prev, [userId]: '' }))
    try {
      const updated = await changeMemberRole(communityId, userId, newRole)
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role: updated.role } : m)))
    } catch (e: unknown) {
      setRoleError((prev) => ({
        ...prev,
        [userId]: e instanceof Error ? e.message : 'Role change failed',
      }))
    } finally {
      setChanging(null)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Members</h1>
          <p className="text-[14px] text-on-surface-variant">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="white" size="sm" onClick={load}>
          <RefreshCw size={13} />
          Refresh
        </Button>
      </div>

      {members.length === 0 ? (
        <EmptyState icon={User} title="No members yet" description="Share the invite code to get members." />
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="border-2 border-black bg-white p-4 neo-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-surface-container border-2 border-black flex items-center justify-center flex-shrink-0">
                  <User size={16} />
                </div>
                <div>
                  <p className="text-[14px] font-bold">{m.full_name ?? `Member #${m.user_id}`}</p>
                  {m.email && (
                    <p className="text-[12px] text-on-surface-variant">{m.email}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isAdmin && m.user_id !== user?.id ? (
                  <div className="flex flex-col gap-1">
                    <select
                      value={m.role}
                      disabled={changing === m.user_id}
                      onChange={(e) => handleRoleChange(m.user_id, e.target.value as MemberRole)}
                      className="border-2 border-black bg-white px-3 py-1.5 text-[13px] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    {changing === m.user_id && (
                      <p className="text-[11px] text-on-surface-variant">Updating…</p>
                    )}
                    {roleError[m.user_id] && (
                      <p className="text-[11px] text-error font-bold">{roleError[m.user_id]}</p>
                    )}
                  </div>
                ) : (
                  <Badge color={roleBadgeColor(m.role as MemberRole)}>{m.role}</Badge>
                )}
                {m.user_id === user?.id && (
                  <span className="text-[11px] font-bold text-on-surface-variant">(you)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
