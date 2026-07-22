import { useState, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { createExpense } from '../lib/api'

const CATEGORIES = [
  'Food & Catering', 'Venue', 'Decoration', 'Printing', 'Transport',
  'Equipment', 'Gifts & Souvenirs', 'Photography', 'Entertainment', 'Other',
]

export default function CreateExpense() {
  const { id } = useParams<{ id: string }>()
  const communityId = Number(id)
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [receiptUrl, setReceiptUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = 'Title is required'
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount'
    return e
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    setFieldErrors({}); setError('')
    setLoading(true)
    try {
      const exp = await createExpense(communityId, {
        title: title.trim(),
        amount: parseFloat(amount),
        category,
        receipt_url: receiptUrl.trim() || undefined,
      })
      navigate(`/expenses/${exp.id}?community=${communityId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit expense')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-tight">New Expense Request</h1>
        <p className="text-[14px] text-on-surface-variant mt-1">Treasurer only — an auditor will review and approve.</p>
      </div>

      {error && (
        <div className="mb-6 border-2 border-error bg-error-container p-3 text-[13px] font-bold text-error">{error}</div>
      )}

      <div className="border-4 border-black neo-shadow-lg bg-white p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input id="title" label="Expense Title" placeholder="e.g. Venue booking deposit"
            value={title} onChange={(e) => setTitle(e.target.value)} error={fieldErrors.title} />

          <Input id="amount" label="Amount (₦)" type="number" min="1" step="0.01" placeholder="e.g. 50000"
            value={amount} onChange={(e) => setAmount(e.target.value)} error={fieldErrors.amount} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="category" className="text-[12px] font-bold uppercase tracking-[0.08em]">Category</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border-2 border-black bg-white px-4 py-3 text-[15px] font-sans focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <Input id="receipt" label="Receipt URL (optional — will be stored in your drive)" type="url"
            placeholder="Paste Google Drive link..."
            value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} />

          <Button type="submit" loading={loading} fullWidth size="lg">
            Submit Request
          </Button>
        </form>
      </div>
    </div>
  )
}
