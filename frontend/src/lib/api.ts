import type {
  TokenResponse, User, Community, CommunityMember, Collection,
  CollectionDetail, CollectionDashboard, CollectionMemberEntry,
  CommunityDashboard, Expense, LedgerResponse, TransparencyReport,
  MemberRole, ActiveCollectionSummary, ReservedAccount,
} from './types'

const BASE_URL = 'https://acafund-1.onrender.com'

// ── Token helpers ─────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem('acafund_token')
}

export function setToken(t: string) {
  localStorage.setItem('acafund_token', t)
}

function clearToken() {
  localStorage.removeItem('acafund_token')
}

export function hasToken(): boolean {
  return Boolean(getToken())
}

export function logout() {
  clearToken()
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function req<T>(
  path: string,
  options: RequestInit = {},
  skipAuth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (!skipAuth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('Unauthorised')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(body.detail ?? 'Request failed')
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function register(full_name: string, email: string, password: string): Promise<TokenResponse> {
  const data = await req<TokenResponse>('/auth/register', {
    method: 'POST', body: JSON.stringify({ full_name, email, password }),
  }, true)
  setToken(data.access_token)
  return data
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const data = await req<TokenResponse>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  }, true)
  setToken(data.access_token)
  return data
}

export async function getMe(): Promise<User> {
  return req<User>('/auth/me')
}

// ── Communities ───────────────────────────────────────────────────────────────

export async function getMyCommunities(): Promise<Community[]> {
  return req<Community[]>('/users/me/communities')
}

export async function createCommunity(name: string, description: string): Promise<Community> {
  return req<Community>('/communities', {
    method: 'POST', body: JSON.stringify({ name, description }),
  })
}

export async function joinCommunity(invite_code: string): Promise<{ message: string; community_id: number }> {
  return req('/communities/join', {
    method: 'POST', body: JSON.stringify({ invite_code }),
  })
}

export async function getCommunity(id: number): Promise<Community> {
  return req<Community>(`/communities/${id}`)
}

export async function getCommunityDashboard(id: number): Promise<CommunityDashboard> {
  return req<CommunityDashboard>(`/communities/${id}/dashboard`)
}

export async function getMembers(communityId: number): Promise<CommunityMember[]> {
  return req<CommunityMember[]>(`/communities/${communityId}/members`)
}

export async function changeMemberRole(communityId: number, userId: number, role: MemberRole): Promise<CommunityMember> {
  return req<CommunityMember>(`/communities/${communityId}/members/${userId}/role`, {
    method: 'PATCH', body: JSON.stringify({ new_role: role }),
  })
}

// ── Collections ───────────────────────────────────────────────────────────────

export async function getCollections(communityId: number): Promise<Collection[]> {
  return req<Collection[]>(`/communities/${communityId}/collections`)
}

export async function createCollection(
  communityId: number,
  data: {
    title: string
    description?: string
    amount_per_member: number
    deadline?: string
    budget_allocation?: Record<string, number>
  },
): Promise<Collection> {
  return req<Collection>(`/communities/${communityId}/collections`, {
    method: 'POST', body: JSON.stringify(data),
  })
}

export async function getCollection(id: number): Promise<CollectionDetail> {
  return req<CollectionDetail>(`/collections/${id}`)
}

export async function getCollectionDashboard(id: number): Promise<CollectionDashboard> {
  return req<CollectionDashboard>(`/collections/${id}/dashboard`)
}

export async function getMyPayment(collectionId: number): Promise<CollectionMemberEntry> {
  return req<CollectionMemberEntry>(`/collections/${collectionId}/payments/me`)
}

export async function closeCollection(id: number): Promise<Collection> {
  return req<Collection>(`/collections/${id}/close`, { method: 'PATCH' })
}

export async function initiatePayment(collectionId: number): Promise<{ checkout_url: string; payment_reference: string }> {
  const redirect_url = `${window.location.origin}/payment-return?collection_id=${collectionId}`
  return req(`/collections/${collectionId}/pay`, {
    method: 'POST', body: JSON.stringify({ redirect_url }),
  })
}

export async function syncPayment(paymentId: number): Promise<CollectionMemberEntry> {
  return req<CollectionMemberEntry>(`/payments/${paymentId}/sync`, { method: 'POST' })
}

export async function getTransparencyReport(collectionId: number): Promise<TransparencyReport> {
  return req<TransparencyReport>(`/collections/${collectionId}/transparency`, {}, true)
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function getExpenses(communityId: number): Promise<Expense[]> {
  return req<Expense[]>(`/communities/${communityId}/expenses`)
}

export async function createExpense(
  communityId: number,
  data: {
    title: string
    amount: number
    category: string
    receipt_url?: string
    collection_id?: number
    destination_bank_name: string
    destination_account_number: string
    destination_account_name: string
  },
): Promise<Expense> {
  return req<Expense>(`/communities/${communityId}/expenses`, {
    method: 'POST', body: JSON.stringify(data),
  })
}

export async function getReservedAccount(communityId: number): Promise<ReservedAccount | null> {
  try {
    return await req<ReservedAccount>(`/communities/${communityId}/reserved-account`)
  } catch (e) {
    if (e instanceof Error && e.message.toLowerCase().includes('not found')) return null
    throw e
  }
}

export async function setupReservedAccount(communityId: number, bvn: string): Promise<ReservedAccount> {
  return req<ReservedAccount>(`/communities/${communityId}/reserved-account`, {
    method: 'POST', body: JSON.stringify({ bvn }),
  })
}

export async function markExpensePaidOut(expenseId: number, payout_reference: string): Promise<Expense> {
  return req<Expense>(`/expenses/${expenseId}/mark-paid-out`, {
    method: 'POST', body: JSON.stringify({ payout_reference }),
  })
}

export async function approveExpense(expenseId: number, note?: string): Promise<Expense> {
  return req<Expense>(`/expenses/${expenseId}/approve`, {
    method: 'POST', body: JSON.stringify({ decision_note: note ?? null }),
  })
}

export async function rejectExpense(expenseId: number, note: string): Promise<Expense> {
  return req<Expense>(`/expenses/${expenseId}/reject`, {
    method: 'POST', body: JSON.stringify({ decision_note: note }),
  })
}

// ── Ledger ────────────────────────────────────────────────────────────────────

export async function getLedger(communityId: number): Promise<LedgerResponse> {
  return req<LedgerResponse>(`/communities/${communityId}/ledger`)
}

// ── AI Assistant ──────────────────────────────────────────────────────────────

export async function askAssistant(communityId: number, question: string): Promise<{ answer: string }> {
  return req<{ answer: string }>(`/communities/${communityId}/assistant/ask`, {
    method: 'POST', body: JSON.stringify({ question }),
  })
}
