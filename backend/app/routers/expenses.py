from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_community_role
from app.core.security import get_current_user
from app.database import get_db
from app.models.community import CommunityMember
from app.models.enums import ExpenseStatus, LedgerEntryType, MemberRole
from app.models.expense import Expense
from app.models.ledger import LedgerEntry
from app.services.ledger import get_balance, record_debit

router = APIRouter(tags=["expenses"])

ALL_ROLES = [MemberRole.ADMIN, MemberRole.TREASURER, MemberRole.AUDITOR, MemberRole.MEMBER]


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateExpenseIn(BaseModel):
    title: str
    amount: float
    category: str
    collection_id: Optional[int] = None
    receipt_url: Optional[str] = None
    destination_bank_name: Optional[str] = None
    destination_account_number: Optional[str] = None
    destination_account_name: Optional[str] = None


class DecisionIn(BaseModel):
    decision_note: Optional[str] = None


class RejectIn(BaseModel):
    decision_note: str


class MarkPaidOutIn(BaseModel):
    payout_reference: str


class ExpenseOut(BaseModel):
    id: int
    community_id: int
    collection_id: Optional[int] = None
    title: str
    amount: float
    category: str
    receipt_url: Optional[str] = None
    requested_by: int
    status: ExpenseStatus
    approved_by: Optional[int] = None
    decision_note: Optional[str] = None
    created_at: datetime
    decided_at: Optional[datetime] = None
    destination_bank_name: Optional[str] = None
    destination_account_number: Optional[str] = None
    destination_account_name: Optional[str] = None
    payout_reference: Optional[str] = None
    paid_out_at: Optional[datetime] = None
    paid_out_by: Optional[int] = None
    model_config = {"from_attributes": True}


class LedgerEntryOut(BaseModel):
    id: int
    community_id: int
    type: LedgerEntryType
    amount: float
    reference_type: str
    reference_id: int
    description: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class LedgerPageOut(BaseModel):
    balance: float
    total: int
    entries: List[LedgerEntryOut]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_auditor(expense_id: int, current_user, db: Session) -> Expense:
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    mem = (
        db.query(CommunityMember)
        .filter(
            CommunityMember.community_id == expense.community_id,
            CommunityMember.user_id == current_user.id,
        )
        .first()
    )
    if not mem or mem.role != MemberRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditor role required")
    return expense


def _require_admin_or_treasurer(expense: Expense, current_user, db: Session) -> None:
    mem = (
        db.query(CommunityMember)
        .filter(
            CommunityMember.community_id == expense.community_id,
            CommunityMember.user_id == current_user.id,
        )
        .first()
    )
    if not mem or mem.role not in (MemberRole.ADMIN, MemberRole.TREASURER):
        raise HTTPException(status_code=403, detail="Admin or Treasurer role required")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post(
    "/communities/{community_id}/expenses",
    status_code=status.HTTP_201_CREATED,
    response_model=ExpenseOut,
)
def create_expense(
    community_id: int,
    body: CreateExpenseIn,
    _: CommunityMember = Depends(require_community_role([MemberRole.TREASURER])),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = Expense(
        community_id=community_id,
        collection_id=body.collection_id,
        title=body.title,
        amount=body.amount,
        category=body.category,
        receipt_url=body.receipt_url,
        requested_by=current_user.id,
        status=ExpenseStatus.PENDING,
        destination_bank_name=body.destination_bank_name,
        destination_account_number=body.destination_account_number,
        destination_account_name=body.destination_account_name,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return ExpenseOut.model_validate(expense)


@router.post("/expenses/{expense_id}/approve", response_model=ExpenseOut)
def approve_expense(
    expense_id: int,
    body: DecisionIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = _require_auditor(expense_id, current_user, db)

    if expense.requested_by == current_user.id:
        raise HTTPException(status_code=403, detail="Cannot approve your own expense request")

    if expense.status != ExpenseStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Expense already {expense.status}",
        )

    expense.status = ExpenseStatus.APPROVED
    expense.approved_by = current_user.id
    expense.decision_note = body.decision_note
    expense.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(expense)
    return ExpenseOut.model_validate(expense)


@router.post("/expenses/{expense_id}/reject", response_model=ExpenseOut)
def reject_expense(
    expense_id: int,
    body: RejectIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = _require_auditor(expense_id, current_user, db)

    if expense.status != ExpenseStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Expense already {expense.status}",
        )

    expense.status = ExpenseStatus.REJECTED
    expense.approved_by = current_user.id
    expense.decision_note = body.decision_note
    expense.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(expense)
    return ExpenseOut.model_validate(expense)


@router.post("/expenses/{expense_id}/mark-paid-out", response_model=ExpenseOut)
def mark_paid_out(
    expense_id: int,
    body: MarkPaidOutIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    _require_admin_or_treasurer(expense, current_user, db)

    if expense.status != ExpenseStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Expense must be approved before marking as paid out",
        )

    if not body.payout_reference:
        raise HTTPException(status_code=400, detail="payout_reference is required")

    expense.status = ExpenseStatus.PAID_OUT
    expense.paid_out_at = datetime.now(timezone.utc)
    expense.paid_out_by = current_user.id
    expense.payout_reference = body.payout_reference

    record_debit(
        db=db,
        community_id=expense.community_id,
        amount=expense.amount,
        reference_type="expense",
        reference_id=expense.id,
        description=f"Expense paid out: {expense.title} (ref: {body.payout_reference})",
    )
    db.refresh(expense)
    return ExpenseOut.model_validate(expense)


@router.get("/communities/{community_id}/expenses", response_model=List[ExpenseOut])
def list_expenses(
    community_id: int,
    expense_status: Optional[ExpenseStatus] = Query(None, alias="status"),
    _: CommunityMember = Depends(require_community_role(ALL_ROLES)),
    db: Session = Depends(get_db),
):
    q = db.query(Expense).filter(Expense.community_id == community_id)
    if expense_status is not None:
        q = q.filter(Expense.status == expense_status)
    expenses = q.order_by(Expense.created_at.desc()).all()
    return [ExpenseOut.model_validate(e) for e in expenses]


@router.get("/communities/{community_id}/ledger", response_model=LedgerPageOut)
def get_ledger(
    community_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    _: CommunityMember = Depends(require_community_role(ALL_ROLES)),
    db: Session = Depends(get_db),
):
    total = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.community_id == community_id)
        .count()
    )
    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.community_id == community_id)
        .order_by(LedgerEntry.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return LedgerPageOut(
        balance=get_balance(db, community_id),
        total=total,
        entries=entries,
    )
