import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Check } from 'lucide-react'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { createCommunity } from '../lib/api'
import type { Community } from '../lib/types'

export default function CreateCommunity() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<Community | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Community name is required'); return }
    setError('')
    setLoading(true)
    try {
      const community = await createCommunity(name.trim(), description.trim())
      setCreated(community)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create community')
    } finally {
      setLoading(false)
    }
  }

  const copyCode = () => {
    if (!created) return
    navigator.clipboard.writeText(created.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (created) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="border-4 border-black neo-shadow-lg bg-primary-container p-8">
          <div className="w-14 h-14 bg-black flex items-center justify-center mb-6">
            <Check size={24} className="text-primary-container" />
          </div>
          <h1 className="text-[28px] font-bold mb-2">Community Created!</h1>
          <p className="text-[15px] text-on-primary-container/80 mb-8">
            <span className="font-bold">{created.name}</span> is live. Share the invite code below with your members.
          </p>

          <div className="bg-white border-2 border-black p-5 mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-on-surface-variant mb-2">
              Invite Code
            </p>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[28px] font-bold tracking-[0.15em]">{created.invite_code}</span>
              <button
                onClick={copyCode}
                className="flex items-center gap-2 border-2 border-black px-3 py-2 text-[12px] font-bold uppercase tracking-widest neo-shadow neo-btn bg-surface-container"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <p className="text-[12px] text-on-primary-container/70 mb-8">
            Members use this code at "Join Community." You can also find it in community settings.
          </p>

          <Button
            variant="black"
            fullWidth
            size="lg"
            onClick={() => navigate(`/communities/${created.id}`)}
          >
            Go to Dashboard →
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-[32px] font-bold tracking-tight">Create a Community</h1>
        <p className="text-[15px] text-on-surface-variant mt-1">
          You'll become the admin and receive an invite code to share.
        </p>
      </div>

      {error && (
        <div className="mb-6 border-2 border-error bg-error-container p-3 text-[13px] font-bold text-error">
          {error}
        </div>
      )}

      <div className="border-4 border-black neo-shadow-lg bg-white p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            id="name"
            label="Community Name"
            placeholder="e.g. CSC 400 Level 2024/25"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="desc" className="text-[12px] font-bold uppercase tracking-[0.08em]">
              Description <span className="text-on-surface-variant font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="desc"
              rows={3}
              placeholder="What is this community for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border-2 border-black bg-white px-4 py-3 text-[15px] font-sans focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          <Button type="submit" loading={loading} fullWidth size="lg">
            Create Community
          </Button>
        </form>
      </div>
    </div>
  )
}
