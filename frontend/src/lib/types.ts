export type MemberRole = 'admin' | 'treasurer' | 'auditor' | 'member'
export type CollectionStatus = 'draft' | 'active' | 'closed'
export type MemberPaymentStatus = 'pending' | 'paid' | 'waived'
export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'paid_out'
export type LedgerEntryType = 'credit' | 'debit'

export interface User {
  id: number
  email: string
  full_name: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface ReservedAccount {
  bank_name: string
  account_number: string
  account_name: string
  status: 'active' | 'pending' | 'failed'
}

export interface Community {
  id: number
  name: string
  description: string | null
  invite_code: string
  created_by: number
  reserved_account?: ReservedAccount | null
}

export interface CommunityMember {
  id: number
  community_id: number
  user_id: number
  role: MemberRole
  full_name?: string | null
  email?: string | null
}

export interface Collection {
  id: number
  community_id: number
  title: string
  description: string | null
  amount_per_member: number
  target_amount: number | null
  deadline: string | null
  budget_allocation: Record<string, number> | null
  status: CollectionStatus
  created_by: number
  created_at: string
}

export interface CollectionMemberEntry {
  id: number
  collection_id: number
  user_id: number
  amount_due: number
  status: MemberPaymentStatus
  paid_at: string | null
}

export interface CollectionDetail extends Collection {
  members: CollectionMemberEntry[]
}

export interface CollectionDashboard {
  total_members: number
  paid_count: number
  pending_count: number
  waived_count: number
  amount_collected: number
  amount_outstanding: number
  percent_target_reached: number
}

export interface ActiveCollectionSummary {
  id: number
  title: string
  target_amount: number | null
  amount_collected: number
  paid_count: number
  pending_count: number
}

export interface LedgerEntryOut {
  id: number
  type: LedgerEntryType
  amount: number
  reference_type: string
  reference_id: number
  description: string | null
  created_at: string
}

export interface CommunityDashboard {
  treasury_balance: number
  active_collections: ActiveCollectionSummary[]
  pending_expenses_count: number
  recent_ledger: LedgerEntryOut[]
}

export interface Expense {
  id: number
  community_id: number
  collection_id: number | null
  title: string
  amount: number
  category: string
  status: ExpenseStatus
  receipt_url: string | null
  requested_by: number
  approved_by: number | null
  decision_note: string | null
  created_at: string
  decided_at: string | null
  destination_bank_name: string | null
  destination_account_number: string | null
  destination_account_name: string | null
  payout_reference: string | null
  paid_out_at: string | null
  paid_out_by: number | null
}

export interface LedgerEntry {
  id: number
  type: LedgerEntryType
  amount: number
  description: string | null
  created_at: string
}

export interface LedgerResponse {
  entries: LedgerEntry[]
  balance: number
  total: number
}

export interface TransparencyExpense {
  title: string
  amount: number
  category: string
  status: ExpenseStatus
  payout_reference: string | null
  paid_out_at: string | null
}

export interface TransparencyReport {
  id: number
  title: string
  description: string | null
  target_amount: number | null
  amount_collected: number
  paid_count: number
  pending_count: number
  waived_count: number
  budget_allocation: Record<string, number> | null
  expenses: TransparencyExpense[]
  reserved_account?: ReservedAccount | null
}

export interface ApiError {
  detail: string
}
