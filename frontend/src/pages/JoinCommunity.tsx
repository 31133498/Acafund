import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { joinCommunity } from '../lib/api'

export default function JoinCommunity() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) { setError('Please enter an invite code'); return }
    setError('')
    setLoading(true)
    try {
      const res = await joinCommunity(code.trim().toLowerCase())
      navigate(`/communities/${res.community_id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('not found'))
        setError('Invalid invite code. Check with your admin and try again.')
      else if (msg.toLowerCase().includes('already'))
        setError("You're already a member of this community.")
      else
        setError(msg || 'Failed to join. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-[32px] font-bold tracking-tight">Join a Community</h1>
        <p className="text-[15px] text-on-surface-variant mt-1">
          Enter the invite code your community admin shared with you.
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
            id="code"
            label="Invite Code"
            placeholder="e.g. aB3xY9kL"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="text-center text-[22px] tracking-[0.2em] font-bold"
          />
          <Button type="submit" loading={loading} fullWidth size="lg">
            Join Community
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-[13px] text-on-surface-variant">
        Don't have a code? Ask your class admin or{' '}
        <button
          onClick={() => navigate('/communities/create')}
          className="font-bold text-primary hover:underline"
        >
          create your own community
        </button>
        .
      </p>
    </div>
  )
}
