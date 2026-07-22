import type {
  TokenResponse, User, Community, CommunityMember, Collection,
  CollectionDetail, CollectionDashboard, CollectionMemberEntry,
  CommunityDashboard, Expense, LedgerResponse, TransparencyReport,
  MemberRole, ActiveCollectionSummary, ReservedAccount,
} from './types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

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

// When the backend is unreachable, req() throws a TypeError ("Failed to fetch").
// Each exported function catches that specifically and returns offline stand-in data
// so the UI can navigate normally. Real HTTP errors (4xx/5xx) still surface as errors.
function isOffline(e: unknown): boolean {
  return e instanceof TypeError
}

// ── Offline stand-in data ─────────────────────────────────────────────────────

const OFFLINE_USER: User = { id: 1, full_name: 'You', email: '' }

const OFFLINE_COMMUNITY = (overrides: Partial<Community> = {}): Community => ({
  id: 1, name: 'My Community', description: null,
  invite_code: 'INVITE-001', created_by: 1, ...overrides,
})

const OFFLINE_MEMBER = (userId = 1, role: MemberRole = 'admin'): CommunityMember => ({
  id: userId, community_id: 1, user_id: userId, role,
})

const OFFLINE_COLLECTION = (overrides: Partial<Collection> = {}): Collection => ({
  id: 1, community_id: 1, title: 'Collection', description: null,
  amount_per_member: 0, target_amount: null, deadline: null,
  budget_allocation: null, status: 'active', created_by: 1,
  created_at: new Date().toISOString(), ...overrides,
})

const OFFLINE_EXPENSE = (overrides: Partial<Expense> = {}): Expense => ({
  id: 1, community_id: 1, title: 'Expense', amount: 0, category: 'Other',
  status: 'pending', receipt_url: null, requested_by: 1, approved_by: null,
  collection_id: null, created_at: new Date().toISOString(), decision_note: null,
  decided_at: null, destination_bank_name: null, destination_account_number: null,
  destination_account_name: null, payout_reference: null, paid_out_at: null,
  paid_out_by: null, ...overrides,
})

const OFFLINE_RESERVED_ACCOUNT = (): ReservedAccount => ({
  bank_name: 'First Bank', account_number: '3012345678',
  account_name: 'AcaFund Demo Community', status: 'active',
})

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function register(full_name: string, email: string, password: string): Promise<TokenResponse> {
  try {
    const data = await req<TokenResponse>('/auth/register', {
      method: 'POST', body: JSON.stringify({ full_name, email, password }),
    }, true)
    setToken(data.access_token)
    return data
  } catch (e) {
    if (!isOffline(e)) throw e
    const token = 'local-session'
    setToken(token)
    return { access_token: token, token_type: 'bearer' }
  }
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  try {
    const data = await req<TokenResponse>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }, true)
    setToken(data.access_token)
    return data
  } catch (e) {
    if (!isOffline(e)) throw e
    const token = 'local-session'
    setToken(token)
    return { access_token: token, token_type: 'bearer' }
  }
}

export async function getMe(): Promise<User> {
  try {
    return await req<User>('/auth/me')
  } catch (e) {
    if (!isOffline(e)) throw e
    return OFFLINE_USER
  }
}

// ── Communities ───────────────────────────────────────────────────────────────

export async function getMyCommunities(): Promise<Community[]> {
  try {
    return await req<Community[]>('/users/me/communities')
  } catch (e) {
    if (!isOffline(e)) throw e
    return []
  }
}

export async function createCommunity(name: string, description: string): Promise<Community> {
  try {
    return await req<Community>('/communities', {
      method: 'POST', body: JSON.stringify({ name, description }),
    })
  } catch (e) {
    if (!isOffline(e)) throw e
    return OFFLINE_COMMUNITY({ id: Date.now(), name, description: description || null })
  }
}

export async function joinCommunity(invite_code: string): Promise<{ message: string; community_id: number }> {
  try {
    return await req('/communities/join', {
      method: 'POST', body: JSON.stringify({ invite_code }),
    })
  } catch (e) {
    if (!isOffline(e)) throw e
    return { message: 'Joined successfully', community_id: 1 }
  }
}

export async function getCommunity(id: number): Promise<Community> {
  try {
    return await req<Community>(`/communities/${id}`)
  } catch (e) {
    if (!isOffline(e)) throw e
    return OFFLINE_COMMUNITY({ id })
  }
}

export async function getCommunityDashboard(id: number): Promise<CommunityDashboard> {
  try {
    return await req<CommunityDashboard>(`/communities/${id}/dashboard`)
  } catch (e) {
    if (!isOffline(e)) throw e
    return { treasury_balance: 0, active_collections: [] as ActiveCollectionSummary[], pending_expenses_count: 0, recent_ledger: [] }
  }
}

export async function getMembers(communityId: number): Promise<CommunityMember[]> {
  try {
    return await req<CommunityMember[]>(`/communities/${communityId}/members`)
  } catch (e) {
    if (!isOffline(e)) throw e
    return [OFFLINE_MEMBER(1, 'admin')]
  }
}

export async function changeMemberRole(communityId: number, userId: number, role: MemberRole): Promise<CommunityMember> {
  try {
    return await req<CommunityMember>(`/communities/${communityId}/members/${userId}/role`, {
      method: 'PATCH', body: JSON.stringify({ new_role: role }),
    })
  } catch (e) {
    if (!isOffline(e)) throw e
    return OFFLINE_MEMBER(userId, role)
  }
}

// ── Collections ───────────────────────────────────────────────────────────────

export async function getCollections(communityId: number): Promise<Collection[]> {
  try {
    return await req<Collection[]>(`/communities/${communityId}/collections`)
  } catch (e) {
    if (!isOffline(e)) throw e
    return []
  }
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
  try {
    return await req<Collection>(`/communities/${communityId}/collections`, {
      method: 'POST', body: JSON.stringify(data),
    })
  } catch (e) {
    if (!isOffline(e)) throw e
    return OFFLINE_COLLECTION({
      id: Date.now(), community_id: communityId,
      title: data.title, description: data.description ?? null,
      amount_per_member: data.amount_per_member,
      deadline: data.deadline ?? null,
      budget_allocation: data.budget_allocation ?? null,
    })
  }
}

export async function getCollection(id: number): Promise<CollectionDetail> {
  try {
    return await req<CollectionDetail>(`/collections/${id}`)
  } catch (e) {
    if (!isOffline(e)) throw e
    return { ...OFFLINE_COLLECTION({ id }), members: [] }
  }
}

export async function getCollectionDashboard(id: number): Promise<CollectionDashboard> {
  try {
    return await req<CollectionDashboard>(`/collections/${id}/dashboard`)
  } catch (e) {
    if (!isOffline(e)) throw e
    return { total_members: 0, paid_count: 0, pending_count: 0, waived_count: 0, amount_collected: 0, amount_outstanding: 0, percent_target_reached: 0 }
  }
}

export async function getMyPayment(collectionId: number): Promise<CollectionMemberEntry> {
  try {
    return await req<CollectionMemberEntry>(`/collections/${collectionId}/payments/me`)
  } catch (e) {
    if (!isOffline(e)) throw e
    return { id: 1, collection_id: collectionId, user_id: 1, amount_due: 0, status: 'pending', paid_at: null }
  }
}

export async function closeCollection(id: number): Promise<Collection> {
  try {
    return await req<Collection>(`/collections/${id}/close`, { method: 'PATCH' })
  } catch (e) {
    if (!isOffline(e)) throw e
    return OFFLINE_COLLECTION({ id, status: 'closed' })
  }
}

export async function initiatePayment(collectionId: number): Promise<{ checkout_url: string; payment_reference: string }> {
  try {
    const redirect_url = `${window.location.origin}/payment-return?collection_id=${collectionId}`
    return await req(`/collections/${collectionId}/pay`, {
      method: 'POST', body: JSON.stringify({ redirect_url }),
    })
  } catch (e) {
    if (!isOffline(e)) throw e
    return { checkout_url: `${window.location.origin}/payment-return?collection_id=${collectionId}`, payment_reference: '' }
  }
}

export async function syncPayment(paymentId: number): Promise<CollectionMemberEntry> {
  try {
    return await req<CollectionMemberEntry>(`/payments/${paymentId}/sync`, { method: 'POST' })
  } catch (e) {
    if (!isOffline(e)) throw e
    return { id: paymentId, collection_id: 1, user_id: 1, amount_due: 0, status: 'paid', paid_at: new Date().toISOString() }
  }
}

export async function getTransparencyReport(collectionId: number): Promise<TransparencyReport> {
  try {
    return await req<TransparencyReport>(`/collections/${collectionId}/transparency`, {}, true)
  } catch (e) {
    if (!isOffline(e)) throw e
    return { id: collectionId, title: 'Collection', description: null, target_amount: null, amount_collected: 0, paid_count: 0, pending_count: 0, waived_count: 0, budget_allocation: null, expenses: [] }
  }
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function getExpenses(communityId: number): Promise<Expense[]> {
  try {
    return await req<Expense[]>(`/communities/${communityId}/expenses`)
  } catch (e) {
    if (!isOffline(e)) throw e
    return []
  }
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
  try {
    return await req<Expense>(`/communities/${communityId}/expenses`, {
      method: 'POST', body: JSON.stringify(data),
    })
  } catch (e) {
    if (!isOffline(e)) throw e
    return OFFLINE_EXPENSE({
      id: Date.now(), community_id: communityId,
      title: data.title, amount: data.amount, category: data.category,
      receipt_url: data.receipt_url ?? null,
      collection_id: data.collection_id ?? null,
      destination_bank_name: data.destination_bank_name,
      destination_account_number: data.destination_account_number,
      destination_account_name: data.destination_account_name,
    })
  }
}

export async function getReservedAccount(communityId: number): Promise<ReservedAccount | null> {
  try {
    // TODO(endpoint): GET /communities/{id}/reserved-account
    return await req<ReservedAccount>(`/communities/${communityId}/reserved-account`)
  } catch (e) {
    if (isOffline(e)) return null
    // 404 means no account set up yet — return null so UI shows setup prompt
    if (e instanceof Error && e.message.toLowerCase().includes('not found')) return null
    throw e
  }
}

export async function setupReservedAccount(communityId: number): Promise<ReservedAccount> {
  try {
    // TODO(endpoint): POST /communities/{id}/reserved-account
    return await req<ReservedAccount>(`/communities/${communityId}/reserved-account`, { method: 'POST' })
  } catch (e) {
    if (!isOffline(e)) throw e
    return OFFLINE_RESERVED_ACCOUNT()
  }
}

export async function markExpensePaidOut(expenseId: number, payout_reference: string): Promise<Expense> {
  try {
    // TODO(endpoint): POST /expenses/{id}/mark-paid-out
    return await req<Expense>(`/expenses/${expenseId}/mark-paid-out`, {
      method: 'POST', body: JSON.stringify({ payout_reference }),
    })
  } catch (e) {
    if (!isOffline(e)) throw e
    return OFFLINE_EXPENSE({
      id: expenseId, status: 'paid_out',
      payout_reference, paid_out_at: new Date().toISOString(),
    })
  }
}

export async function approveExpense(expenseId: number, note?: string): Promise<Expense> {
  try {
    return await req<Expense>(`/expenses/${expenseId}/approve`, {
      method: 'POST', body: JSON.stringify({ decision_note: note ?? null }),
    })
  } catch (e) {
    if (!isOffline(e)) throw e
    return OFFLINE_EXPENSE({ id: expenseId, status: 'approved', decision_note: note ?? null })
  }
}

export async function rejectExpense(expenseId: number, note: string): Promise<Expense> {
  try {
    return await req<Expense>(`/expenses/${expenseId}/reject`, {
      method: 'POST', body: JSON.stringify({ decision_note: note }),
    })
  } catch (e) {
    if (!isOffline(e)) throw e
    return OFFLINE_EXPENSE({ id: expenseId, status: 'rejected', decision_note: note })
  }
}

// ── Ledger ────────────────────────────────────────────────────────────────────

export async function getLedger(communityId: number): Promise<LedgerResponse> {
  try {
    return await req<LedgerResponse>(`/communities/${communityId}/ledger`)
  } catch (e) {
    if (!isOffline(e)) throw e
    return { entries: [], balance: 0, total: 0 }
  }
}

// ── AI Assistant ──────────────────────────────────────────────────────────────

export async function askAssistant(communityId: number, question: string): Promise<{ answer: string }> {
  try {
    return await req<{ answer: string }>(`/communities/${communityId}/assistant/ask`, {
      method: 'POST', body: JSON.stringify({ question }),
    })
  } catch (e) {
    if (!isOffline(e)) throw e
    return { answer: `Backend not yet connected. Question received: "${question}"` }
  }
}
