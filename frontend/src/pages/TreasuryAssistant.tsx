import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Send, Sparkles, User } from 'lucide-react'
import { askAssistant } from '../lib/api'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

const STARTERS = [
  'What is our current collection progress?',
  'Which members haven\'t paid yet?',
  'Summarise our expenses so far.',
  'How much is left in the treasury?',
]

export default function TreasuryAssistant() {
  const { id } = useParams<{ id: string }>()
  const communityId = Number(id)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (question: string) => {
    if (!question.trim() || loading) return
    setError('')
    setMessages((prev) => [...prev, { role: 'user', text: question }])
    setInput('')
    setLoading(true)
    try {
      const { answer } = await askAssistant(communityId, question.trim())
      setMessages((prev) => [...prev, { role: 'assistant', text: answer }])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Assistant unavailable')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b-2 border-black flex-shrink-0">
        <div className="w-10 h-10 bg-secondary flex items-center justify-center border-2 border-black">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold leading-tight">Treasury Assistant</h1>
          <p className="text-[12px] text-on-surface-variant">Ask anything about your community finances</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-6 py-10">
            <div className="w-16 h-16 bg-secondary/10 border-2 border-black flex items-center justify-center">
              <Sparkles size={28} className="text-secondary" />
            </div>
            <div className="text-center">
              <p className="text-[16px] font-bold mb-1">Ask your treasury anything</p>
              <p className="text-[13px] text-on-surface-variant">Powered by AI — answers are based on your community data.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="border-2 border-black bg-white p-3 text-left text-[13px] font-bold neo-shadow-sm neo-btn hover:bg-primary-container/20 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`w-8 h-8 flex-shrink-0 border-2 border-black flex items-center justify-center ${
              msg.role === 'user' ? 'bg-primary-container' : 'bg-secondary'
            }`}>
              {msg.role === 'user'
                ? <User size={14} />
                : <Sparkles size={14} className="text-white" />
              }
            </div>
            <div
              className={`max-w-[80%] border-2 border-black p-4 text-[14px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary-container text-on-primary-container'
                  : 'bg-white'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-secondary border-2 border-black flex items-center justify-center flex-shrink-0">
              <Sparkles size={14} className="text-white" />
            </div>
            <div className="border-2 border-black bg-white p-4 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 bg-on-surface-variant rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="border-2 border-error bg-error-container p-3 text-[13px] font-bold text-error">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex-shrink-0 border-t-2 border-black pt-4 flex gap-2">
        <textarea
          rows={1}
          placeholder="Ask about balances, collections, payments…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="flex-1 border-2 border-black bg-white px-4 py-3 text-[14px] font-sans focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:bg-surface-container"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="w-12 h-12 bg-secondary text-white border-2 border-black flex items-center justify-center neo-shadow neo-btn disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={18} />
        </button>
      </form>
      <p className="text-[11px] text-on-surface-variant text-center mt-2">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}
