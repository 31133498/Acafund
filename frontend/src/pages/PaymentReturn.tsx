import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import Button from '../components/ui/Button'
import { getMyPayment, syncPayment } from '../lib/api'

export default function PaymentReturn() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Monnify can corrupt query params on redirect — sessionStorage is the reliable source
  const collectionId = Number(
    searchParams.get('collection_id') ?? sessionStorage.getItem('acafund_payment_collection_id')
  )
  const paymentId = Number(searchParams.get('payment_id'))

  const [status, setStatus] = useState<'confirming' | 'paid' | 'pending' | 'error'>('confirming')
  const [syncing, setSyncing] = useState(false)
  const pollRef = useRef<number | null>(null)

  const checkStatus = async () => {
    if (!collectionId) { setStatus('error'); return }
    try {
      const pay = await getMyPayment(collectionId)
      if (pay.status === 'paid') {
        setStatus('paid')
        sessionStorage.removeItem('acafund_payment_collection_id')
        if (pollRef.current) clearInterval(pollRef.current)
      }
    } catch {
      // keep polling
    }
  }

  useEffect(() => {
    if (!collectionId) { setStatus('error'); return }

    // Poll every 2s for up to 20s
    let count = 0
    pollRef.current = window.setInterval(async () => {
      count++
      await checkStatus()
      if (count >= 10) {
        if (pollRef.current) clearInterval(pollRef.current)
        setStatus((prev) => (prev === 'confirming' ? 'pending' : prev))
      }
    }, 2000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [collectionId])

  const handleSync = async () => {
    if (!paymentId) return
    setSyncing(true)
    try {
      await syncPayment(paymentId)
      await checkStatus()
    } catch {
      // show current state
    } finally {
      setSyncing(false)
    }
  }

  if (status === 'confirming') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="border-4 border-black neo-shadow-lg bg-white p-10 max-w-sm w-full text-center">
          <div className="w-14 h-14 border-4 border-black border-t-primary rounded-full animate-spin mx-auto mb-6" />
          <h1 className="text-[22px] font-bold mb-2">Confirming Payment</h1>
          <p className="text-[14px] text-on-surface-variant">
            We're verifying your payment with the bank. This usually takes a few seconds…
          </p>
        </div>
      </div>
    )
  }

  if (status === 'paid') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="border-4 border-black neo-shadow-lg bg-primary-container p-10 max-w-sm w-full text-center">
          <CheckCircle size={48} className="mx-auto mb-4 text-primary" />
          <h1 className="text-[24px] font-bold mb-2">Payment Confirmed!</h1>
          <p className="text-[14px] text-on-primary-container/80 mb-8">
            Your dues have been received and recorded. Thank you!
          </p>
          <Button
            variant="black"
            fullWidth
            onClick={() => navigate(`/collections/${collectionId}`)}
          >
            Back to Collection
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="border-4 border-black neo-shadow-lg bg-white p-10 max-w-sm w-full text-center">
          <AlertTriangle size={40} className="mx-auto mb-4 text-error" />
          <h1 className="text-[22px] font-bold mb-2">Still Processing</h1>
          <p className="text-[14px] text-on-surface-variant mb-8">
            Your payment is still being processed. If you've completed checkout, it may take a little longer to reflect.
          </p>
          <div className="flex flex-col gap-3">
            {paymentId ? (
              <Button variant="primary" fullWidth loading={syncing} onClick={handleSync}>
                <RefreshCw size={14} />
                Sync Payment Status
              </Button>
            ) : null}
            <Button variant="white" fullWidth onClick={() => navigate(`/collections/${collectionId}`)}>
              Back to Collection
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="border-4 border-black neo-shadow-lg bg-white p-10 max-w-sm w-full text-center">
        <AlertTriangle size={40} className="mx-auto mb-4 text-error" />
        <h1 className="text-[22px] font-bold mb-2">Something went wrong</h1>
        <p className="text-[14px] text-on-surface-variant mb-8">
          We couldn't verify your payment. Please check with your admin.
        </p>
        <Button variant="white" fullWidth onClick={() => navigate('/communities')}>
          Go to My Communities
        </Button>
      </div>
    </div>
  )
}
