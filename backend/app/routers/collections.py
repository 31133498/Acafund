from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.core.deps import require_community_role
from app.core.security import get_current_user
from app.database import get_db
from app.models.collection import Collection, CollectionMember
from app.models.community import CommunityMember
from app.models.enums import CollectionStatus, MemberPaymentStatus, MemberRole

router = APIRouter(tags=["collections"])

ALL_ROLES = [MemberRole.ADMIN, MemberRole.TREASURER, MemberRole.AUDITOR, MemberRole.MEMBER]


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateCollectionIn(BaseModel):
    title: str
    description: Optional[str] = None
    amount_per_member: float
    target_amount: Optional[float] = None
    deadline: Optional[datetime] = None
    budget_allocation: Optional[dict] = None


class CollectionOut(BaseModel):
    id: int
    community_id: int
    title: str
    description: Optional[str] = None
    amount_per_member: float
    target_amount: Optional[float] = None
    deadline: Optional[datetime] = None
    budget_allocation: Optional[dict] = None
    status: CollectionStatus
    created_by: int
    created_at: datetime
    model_config = {"from_attributes": True}


class CollectionMemberOut(BaseModel):
    id: int
    collection_id: int
    user_id: int
    amount_due: float
    status: MemberPaymentStatus
    paid_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class CollectionDetailOut(CollectionOut):
    members: List[CollectionMemberOut]


class DashboardOut(BaseModel):
    total_members: int
    paid_count: int
    pending_count: int
    waived_count: int
    amount_collected: float
    amount_outstanding: float
    percent_target_reached: float


# ── Helpers ───────────────────────────────────────────────────────────────────

def _validate_budget(allocation: Optional[dict]) -> None:
    if not allocation:
        return
    total = sum(float(v) for v in allocation.values())
    if abs(total - 100.0) > 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"budget_allocation percentages must sum to 100 (got {total:.2f})",
        )


def _get_collection(collection_id: int, db: Session) -> Collection:
    col = db.query(Collection).filter(Collection.id == collection_id).first()
    if not col:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return col


def _assert_community_member(col: Collection, user_id: int, db: Session) -> CommunityMember:
    mem = (
        db.query(CommunityMember)
        .filter(
            CommunityMember.community_id == col.community_id,
            CommunityMember.user_id == user_id,
        )
        .first()
    )
    if not mem:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return mem


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post(
    "/communities/{community_id}/collections",
    status_code=status.HTTP_201_CREATED,
    response_model=CollectionOut,
)
def create_collection(
    community_id: int,
    body: CreateCollectionIn,
    _: CommunityMember = Depends(require_community_role([MemberRole.ADMIN])),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _validate_budget(body.budget_allocation)

    community_members = (
        db.query(CommunityMember)
        .filter(CommunityMember.community_id == community_id)
        .all()
    )

    target = body.target_amount if body.target_amount is not None else (
        body.amount_per_member * len(community_members)
    )

    col = Collection(
        community_id=community_id,
        title=body.title,
        description=body.description,
        amount_per_member=body.amount_per_member,
        target_amount=target,
        deadline=body.deadline,
        budget_allocation=body.budget_allocation,
        status=CollectionStatus.ACTIVE,
        created_by=current_user.id,
    )
    db.add(col)
    db.flush()

    db.add_all([
        CollectionMember(
            collection_id=col.id,
            user_id=m.user_id,
            amount_due=body.amount_per_member,
            status=MemberPaymentStatus.PENDING,
        )
        for m in community_members
    ])
    db.commit()
    db.refresh(col)
    return col


@router.get("/communities/{community_id}/collections", response_model=List[CollectionOut])
def list_collections(
    community_id: int,
    _: CommunityMember = Depends(require_community_role(ALL_ROLES)),
    db: Session = Depends(get_db),
):
    return db.query(Collection).filter(Collection.community_id == community_id).all()


@router.get("/collections/{collection_id}", response_model=CollectionDetailOut)
def get_collection(
    collection_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    col = (
        db.query(Collection)
        .options(selectinload(Collection.members))
        .filter(Collection.id == collection_id)
        .first()
    )
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    _assert_community_member(col, current_user.id, db)
    return col


@router.get("/collections/{collection_id}/dashboard", response_model=DashboardOut)
def get_dashboard(
    collection_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    col = _get_collection(collection_id, db)
    _assert_community_member(col, current_user.id, db)

    col_members = (
        db.query(CollectionMember)
        .filter(CollectionMember.collection_id == col.id)
        .all()
    )

    paid = [m for m in col_members if m.status == MemberPaymentStatus.PAID]
    pending = [m for m in col_members if m.status == MemberPaymentStatus.PENDING]
    waived = [m for m in col_members if m.status == MemberPaymentStatus.WAIVED]
    amount_collected = sum(m.amount_due for m in paid)
    amount_outstanding = sum(m.amount_due for m in pending)
    percent = (amount_collected / col.target_amount * 100) if col.target_amount else 0.0

    return DashboardOut(
        total_members=len(col_members),
        paid_count=len(paid),
        pending_count=len(pending),
        waived_count=len(waived),
        amount_collected=amount_collected,
        amount_outstanding=amount_outstanding,
        percent_target_reached=percent,
    )


@router.patch("/collections/{collection_id}/close", response_model=CollectionOut)
def close_collection(
    collection_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    col = _get_collection(collection_id, db)
    mem = _assert_community_member(col, current_user.id, db)
    if mem.role != MemberRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    col.status = CollectionStatus.CLOSED
    db.commit()
    db.refresh(col)
    return col
