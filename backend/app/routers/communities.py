import logging
import secrets
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_community_role
from app.core.security import get_current_user
from app.database import get_db
from app.models.community import Community, CommunityMember
from app.models.enums import MemberRole
from app.models.user import User  # noqa: F401
from app.services.monnify import MonnifyError, monnify_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/communities", tags=["communities"])

ALL_ROLES = [MemberRole.ADMIN, MemberRole.TREASURER, MemberRole.AUDITOR, MemberRole.MEMBER]


class CreateCommunityIn(BaseModel):
    name: str
    description: Optional[str] = None


class JoinCommunityIn(BaseModel):
    invite_code: str


class ChangeRoleIn(BaseModel):
    new_role: MemberRole


class ReservedAccountOut(BaseModel):
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    account_name: Optional[str] = None


class CommunityOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    invite_code: str
    created_by: int
    monnify_account_number: Optional[str] = None
    monnify_bank_name: Optional[str] = None
    monnify_account_name: Optional[str] = None
    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    id: int
    community_id: int
    user_id: int
    role: MemberRole
    full_name: Optional[str] = None
    email: Optional[str] = None
    model_config = {"from_attributes": False}


class JoinOut(BaseModel):
    message: str
    community_id: int


def _unique_invite_code(db: Session) -> str:
    while True:
        code = secrets.token_urlsafe(6)[:8].lower()
        if not db.query(Community).filter(Community.invite_code == code).first():
            return code


async def _try_reserve_account(community: Community, current_user: User, db: Session) -> None:
    """Best-effort Monnify reserved-account call. Failures are logged, never raised."""
    try:
        result = await monnify_service.reserve_account(
            account_reference=f"acafund-community-{community.id}",
            account_name=community.name,
            customer_email=current_user.email,
            customer_name=community.name,
        )
        community.monnify_account_reference = f"acafund-community-{community.id}"
        community.monnify_account_number = result["account_number"]
        community.monnify_bank_name = result["bank_name"]
        community.monnify_account_name = result["account_name"]
        db.commit()
        db.refresh(community)
    except Exception as exc:
        logger.warning("reserve_account failed for community %s: %s", community.id, exc)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=CommunityOut)
async def create_community(
    body: CreateCommunityIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    community = Community(
        name=body.name,
        description=body.description,
        invite_code=_unique_invite_code(db),
        created_by=current_user.id,
    )
    db.add(community)
    db.flush()
    db.add(CommunityMember(community_id=community.id, user_id=current_user.id, role=MemberRole.ADMIN))
    db.commit()
    db.refresh(community)

    await _try_reserve_account(community, current_user, db)
    return community


@router.post("/join", response_model=JoinOut)
def join_community(
    body: JoinCommunityIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    community = db.query(Community).filter(
        Community.invite_code == body.invite_code.strip().lower()
    ).first()
    if not community:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite code")

    if db.query(CommunityMember).filter(
        CommunityMember.community_id == community.id,
        CommunityMember.user_id == current_user.id,
    ).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already a member")

    db.add(CommunityMember(community_id=community.id, user_id=current_user.id, role=MemberRole.MEMBER))
    db.commit()
    return JoinOut(message="Joined community", community_id=community.id)


@router.get("/{community_id}", response_model=CommunityOut)
def get_community(
    community_id: int,
    _: CommunityMember = Depends(require_community_role(ALL_ROLES)),
    db: Session = Depends(get_db),
):
    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")
    return community


@router.post("/{community_id}/reserved-account/setup", response_model=ReservedAccountOut)
async def setup_reserved_account(
    community_id: int,
    _: CommunityMember = Depends(require_community_role([MemberRole.ADMIN])),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    if community.monnify_account_number:
        return ReservedAccountOut(
            account_number=community.monnify_account_number,
            bank_name=community.monnify_bank_name,
            account_name=community.monnify_account_name,
        )

    try:
        result = await monnify_service.reserve_account(
            account_reference=f"acafund-community-{community.id}",
            account_name=community.name,
            customer_email=current_user.email,
            customer_name=community.name,
        )
    except MonnifyError as exc:
        raise HTTPException(status_code=502, detail=f"Payment gateway error: {exc.message}")

    community.monnify_account_reference = f"acafund-community-{community.id}"
    community.monnify_account_number = result["account_number"]
    community.monnify_bank_name = result["bank_name"]
    community.monnify_account_name = result["account_name"]
    db.commit()

    return ReservedAccountOut(
        account_number=community.monnify_account_number,
        bank_name=community.monnify_bank_name,
        account_name=community.monnify_account_name,
    )


@router.get("/{community_id}/members", response_model=List[MemberOut])
def list_members(
    community_id: int,
    _: CommunityMember = Depends(require_community_role(ALL_ROLES)),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(CommunityMember, User.full_name, User.email)
        .join(User, CommunityMember.user_id == User.id)
        .filter(CommunityMember.community_id == community_id)
        .all()
    )
    return [
        MemberOut(
            id=m.id,
            community_id=m.community_id,
            user_id=m.user_id,
            role=m.role,
            full_name=full_name,
            email=email,
        )
        for m, full_name, email in rows
    ]


@router.patch("/{community_id}/members/{user_id}/role", response_model=MemberOut)
def change_member_role(
    community_id: int,
    user_id: int,
    body: ChangeRoleIn,
    _: CommunityMember = Depends(require_community_role([MemberRole.ADMIN])),
    db: Session = Depends(get_db),
):
    membership = db.query(CommunityMember).filter(
        CommunityMember.community_id == community_id,
        CommunityMember.user_id == user_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    membership.role = body.new_role
    db.commit()
    db.refresh(membership)
    user = db.query(User).filter(User.id == membership.user_id).first()
    return MemberOut(
        id=membership.id,
        community_id=membership.community_id,
        user_id=membership.user_id,
        role=membership.role,
        full_name=user.full_name if user else None,
        email=user.email if user else None,
    )
