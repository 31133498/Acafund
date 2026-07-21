export type MemberRole = 'admin' | 'treasurer' | 'auditor' | 'member'
export type CollectionStatus = 'draft' | 'active' | 'closed'
export type MemberPaymentStatus = 'pending' | 'paid' | 'waived'
export type ExpenseStatus = 'pending' | 'approved' | 'rejected'
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

export interface Community {
  id: number
  name: string
  description: string | null
  invite_code: string
  created_by: number
}

export interface CommunityMember {
  id: number
  community_id: number
  user_id: number
  role: MemberRole
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

export interface CommunityDashboard {
  treasury_balance: number
  active_collections: number
  pending_expenses_count: number
  recent_activity: { description: string; created_at: string }[]
}

export interface Expense {
  id: number
  community_id: number
  title: string
  amount: number
  category: string
  status: ExpenseStatus
  receipt_url: string | null
  created_by: number
  requester_name?: string
  linked_collection_id: number | null
  created_at: string
  notes: string | null
}

export interface LedgerEntry {
  id: number
  type: LedgerEntryType
  amount: number
  balance: number
  description: string
  created_at: string
}

export interface LedgerResponse {
  entries: LedgerEntry[]
  total_balance: number
}

export interface TransparencyReport {
  title: string
  collection_purpose: string
  target_amount: number
  collected_amount: number
  paid_count: number
  pending_count: number
  budget_allocation: Record<string, number> | null
  linked_expenses: { category: string; amount: number; description: string }[]
}

export interface ApiError {
  detail: string
}
