from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_community_role
from app.database import get_db
from app.models.collection import Collection, CollectionMember
from app.models.community import Community, CommunityMember
from app.models.enums import (
    CollectionStatus,
    LedgerEntryType,
    MemberPaymentStatus,
    MemberRole,
    ExpenseStatus,
)
from app.models.expense import Expense
from app.models.ledger import LedgerEntry
from app.services.ledger import get_balance

router = APIRouter(tags=["reports"])

ALL_ROLES = [MemberRole.ADMIN, MemberRole.TREASURER, MemberRole.AUDITOR, MemberRole.MEMBER]


# ── Schemas ───────────────────────────────────────────────────────────────────

class ExpensePublicOut(BaseModel):
    title: str
    amount: float
    category: str
    status: ExpenseStatus
    payout_reference: Optional[str] = None
    paid_out_at: Optional[str] = None


class ReservedAccountInfo(BaseModel):
    bank_name: Optional[str] = None
    account_number: str
    account_name: Optional[str] = None
    status: str = "active"


class TransparencyOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    target_amount: Optional[float] = None
    amount_collected: float
    paid_count: int
    pending_count: int
    waived_count: int
    budget_allocation: Optional[dict] = None
    reserved_account: Optional[ReservedAccountInfo] = None
    expenses: List[ExpensePublicOut]


class ActiveCollectionSummary(BaseModel):
    id: int
    title: str
    target_amount: Optional[float] = None
    amount_collected: float
    paid_count: int
    pending_count: int


class LedgerEntryOut(BaseModel):
    id: int
    type: LedgerEntryType
    amount: float
    reference_type: str
    reference_id: int
    description: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class DashboardOut(BaseModel):
    treasury_balance: float
    active_collections: List[ActiveCollectionSummary]
    pending_expenses_count: int
    recent_ledger: List[LedgerEntryOut]




# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/collections/{collection_id}/transparency", response_model=TransparencyOut)
def get_transparency(
    collection_id: int,
    db: Session = Depends(get_db),
):
    col = db.query(Collection).filter(Collection.id == collection_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")

    members = (
        db.query(CollectionMember)
        .filter(CollectionMember.collection_id == collection_id)
        .all()
    )
    paid = [m for m in members if m.status == MemberPaymentStatus.PAID]
    pending = [m for m in members if m.status == MemberPaymentStatus.PENDING]
    waived = [m for m in members if m.status == MemberPaymentStatus.WAIVED]

    expenses = (
        db.query(Expense)
        .filter(Expense.collection_id == collection_id)
        .all()
    )

    community = db.query(Community).filter(Community.id == col.community_id).first()
    reserved_account = None
    if community and community.reserved_account_number:
        reserved_account = ReservedAccountInfo(
            account_number=community.reserved_account_number,
            bank_name=community.reserved_bank_name,
            account_name=community.reserved_account_name,
            status=community.reserved_account_status or "active",
        )

    return TransparencyOut(
        id=col.id,
        title=col.title,
        description=col.description,
        target_amount=col.target_amount,
        amount_collected=sum(m.amount_due for m in paid),
        paid_count=len(paid),
        pending_count=len(pending),
        waived_count=len(waived),
        budget_allocation=col.budget_allocation,
        reserved_account=reserved_account,
        expenses=[
            ExpensePublicOut(
                title=e.title,
                amount=e.amount,
                category=e.category,
                status=e.status,
                payout_reference=e.payout_reference,
                paid_out_at=e.paid_out_at.isoformat() if e.paid_out_at else None,
            )
            for e in expenses
        ],
    )


@router.get("/communities/{community_id}/dashboard", response_model=DashboardOut)
def get_community_dashboard(
    community_id: int,
    _: CommunityMember = Depends(require_community_role(ALL_ROLES)),
    db: Session = Depends(get_db),
):
    treasury_balance = get_balance(db, community_id)

    active_cols = (
        db.query(Collection)
        .filter(
            Collection.community_id == community_id,
            Collection.status == CollectionStatus.ACTIVE,
        )
        .all()
    )

    collections_summary = []
    for col in active_cols:
        col_members = (
            db.query(CollectionMember)
            .filter(CollectionMember.collection_id == col.id)
            .all()
        )
        paid = [m for m in col_members if m.status == MemberPaymentStatus.PAID]
        pending = [m for m in col_members if m.status == MemberPaymentStatus.PENDING]
        collections_summary.append(
            ActiveCollectionSummary(
                id=col.id,
                title=col.title,
                target_amount=col.target_amount,
                amount_collected=sum(m.amount_due for m in paid),
                paid_count=len(paid),
                pending_count=len(pending),
            )
        )

    pending_expenses_count = (
        db.query(Expense)
        .filter(
            Expense.community_id == community_id,
            Expense.status == ExpenseStatus.PENDING,
        )
        .count()
    )

    recent_ledger = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.community_id == community_id)
        .order_by(LedgerEntry.created_at.desc())
        .limit(10)
        .all()
    )

    return DashboardOut(
        treasury_balance=treasury_balance,
        active_collections=collections_summary,
        pending_expenses_count=pending_expenses_count,
        recent_ledger=recent_ledger,
    )
