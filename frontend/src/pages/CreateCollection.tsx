import { useState, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { createCollection } from '../lib/api'

interface BudgetLine { category: string; percentage: string }

export default function CreateCollection() {
  const { id } = useParams<{ id: string }>()
  const communityId = Number(id)
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amountPerMember, setAmountPerMember] = useState('')
  const [deadline, setDeadline] = useState('')
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([
    { category: '', percentage: '' },
  ])
  const [useBudget, setUseBudget] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const totalPct = budgetLines.reduce((s, l) => s + (parseFloat(l.percentage) || 0), 0)

  const addLine = () => setBudgetLines((prev) => [...prev, { category: '', percentage: '' }])
  const removeLine = (i: number) => setBudgetLines((prev) => prev.filter((_, idx) => idx !== i))
  const updateLine = (i: number, field: keyof BudgetLine, value: string) =>
    setBudgetLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = 'Title is required'
    const amt = parseFloat(amountPerMember)
    if (!amountPerMember || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount'
    if (useBudget) {
      if (Math.abs(totalPct - 100) > 0.01)
        e.budget = `Budget percentages must total 100% (currently ${totalPct.toFixed(1)}%)`
      if (budgetLines.some((l) => !l.category.trim()))
        e.budget = e.budget ?? 'All budget categories must have a name'
    }
    return e
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    setFieldErrors({})
    setError('')
    setLoading(true)
    try {
      const budget_allocation = useBudget
        ? Object.fromEntries(budgetLines.map((l) => [l.category.trim(), parseFloat(l.percentage)]))
        : undefined
      const col = await createCollection(communityId, {
        title: title.trim(),
        description: description.trim() || undefined,
        amount_per_member: parseFloat(amountPerMember),
        deadline: deadline || undefined,
        budget_allocation,
      })
      navigate(`/collections/${col.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create collection')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-tight">New Collection</h1>
        <p className="text-[14px] text-on-surface-variant mt-1">Admin only — members will be enrolled automatically.</p>
      </div>

      {error && (
        <div className="mb-6 border-2 border-error bg-error-container p-3 text-[13px] font-bold text-error">{error}</div>
      )}

      <div className="border-4 border-black neo-shadow-lg bg-white p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Input id="title" label="Title" placeholder="e.g. Departmental Dues 2024/25"
            value={title} onChange={(e) => setTitle(e.target.value)} error={fieldErrors.title} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="desc" className="text-[12px] font-bold uppercase tracking-[0.08em]">
              Description <span className="text-on-surface-variant font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <textarea id="desc" rows={2} placeholder="What is this collection for?"
              value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full border-2 border-black bg-white px-4 py-3 text-[15px] font-sans focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>

          <Input id="amount" label="Amount Per Member (₦)" type="number" min="1" step="0.01"
            placeholder="e.g. 5000"
            value={amountPerMember} onChange={(e) => setAmountPerMember(e.target.value)}
            error={fieldErrors.amount} />

          <Input id="deadline" label="Deadline (optional)" type="datetime-local"
            value={deadline} onChange={(e) => setDeadline(e.target.value)} />

          {/* Budget allocation */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input type="checkbox" checked={useBudget} onChange={(e) => setUseBudget(e.target.checked)}
                className="w-4 h-4 border-2 border-black accent-primary" />
              <span className="text-[13px] font-bold uppercase tracking-[0.06em]">Include Budget Allocation</span>
            </label>

            {useBudget && (
              <div className="border-2 border-black p-4 bg-surface-container-low flex flex-col gap-3">
                {budgetLines.map((line, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <input
                        placeholder="Category (e.g. Venue)"
                        value={line.category}
                        onChange={(e) => updateLine(i, 'category', e.target.value)}
                        className="w-full border-2 border-black bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="w-24">
                      <input
                        type="number" min="0" max="100" step="0.1" placeholder="%"
                        value={line.percentage}
                        onChange={(e) => updateLine(i, 'percentage', e.target.value)}
                        className="w-full border-2 border-black bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    {budgetLines.length > 1 && (
                      <button type="button" onClick={() => removeLine(i)}
                        className="p-2 border-2 border-black hover:bg-error-container transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <button type="button" onClick={addLine}
                    className="flex items-center gap-1 text-[12px] font-bold uppercase tracking-widest hover:text-primary transition-colors">
                    <Plus size={13} /> Add Category
                  </button>
                  <span className={`text-[13px] font-bold ${Math.abs(totalPct - 100) < 0.01 ? 'text-primary' : 'text-error'}`}>
                    Total: {totalPct.toFixed(1)}%
                  </span>
                </div>
                {fieldErrors.budget && (
                  <p className="text-[12px] text-error font-bold">{fieldErrors.budget}</p>
                )}
              </div>
            )}
          </div>

          <Button type="submit" loading={loading} fullWidth size="lg">
            Create Collection
          </Button>
        </form>
      </div>
    </div>
  )
}
