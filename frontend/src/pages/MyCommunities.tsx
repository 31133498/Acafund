import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, LogIn } from 'lucide-react'
import LoadingState from '../components/ui/LoadingState'
import EmptyState from '../components/ui/EmptyState'
import { getMyCommunities } from '../lib/api'
import type { Community } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'

export default function MyCommunities() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyCommunities()
      .then(setCommunities)
      .catch(() => setCommunities([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[13px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
          Welcome back
        </p>
        <h1 className="text-[32px] font-bold tracking-tight">{user?.full_name}</h1>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <button
          onClick={() => navigate('/communities/create')}
          className="border-4 border-black neo-shadow-lg p-6 bg-primary-container text-on-primary-container text-left hover:-translate-y-1 transition-transform group"
        >
          <div className="w-12 h-12 bg-black flex items-center justify-center mb-4">
            <Plus size={22} className="text-white" />
          </div>
          <p className="text-[18px] font-bold">Create Community</p>
          <p className="text-[13px] mt-1 text-on-primary-container/70">
            Start a new chapter treasury as admin
          </p>
        </button>

        <button
          onClick={() => navigate('/communities/join')}
          className="border-4 border-black neo-shadow-lg p-6 bg-secondary-fixed text-on-surface text-left hover:-translate-y-1 transition-transform group"
        >
          <div className="w-12 h-12 bg-black flex items-center justify-center mb-4">
            <LogIn size={22} className="text-white" />
          </div>
          <p className="text-[18px] font-bold">Join Community</p>
          <p className="text-[13px] mt-1 text-on-surface-variant">
            Enter an invite code from your admin
          </p>
        </button>
      </div>

      {/* Community list */}
      <div>
        <h2 className="text-[14px] font-bold uppercase tracking-[0.08em] mb-4 text-on-surface-variant">
          Your Communities
        </h2>

        {communities.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No communities yet"
            description="Create your own community or join one with an invite code."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {communities.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/communities/${c.id}`)}
                className="border-2 border-black bg-white p-5 neo-shadow neo-btn text-left flex justify-between items-center group"
              >
                <div>
                  <p className="text-[16px] font-bold">{c.name}</p>
                  {c.description && (
                    <p className="text-[13px] text-on-surface-variant mt-0.5">{c.description}</p>
                  )}
                </div>
                <div className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">
                  Open →
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
