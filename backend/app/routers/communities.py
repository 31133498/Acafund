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

router = APIRouter(prefix="/communities", tags=["communities"])

ALL_ROLES = [MemberRole.ADMIN, MemberRole.TREASURER, MemberRole.AUDITOR, MemberRole.MEMBER]


class CreateCommunityIn(BaseModel):
    name: str
    description: Optional[str] = None


class JoinCommunityIn(BaseModel):
    invite_code: str


class ChangeRoleIn(BaseModel):
    new_role: MemberRole


class SetupReservedAccountIn(BaseModel):
    bvn: str


class ReservedAccountOut(BaseModel):
    bank_name: str
    account_number: str
    account_name: str
    status: str


class CommunityOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    invite_code: str
    created_by: int
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


@router.post("", status_code=status.HTTP_201_CREATED, response_model=CommunityOut)
def create_community(
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


@router.get("/{community_id}/reserved-account", response_model=Optional[ReservedAccountOut])
def get_reserved_account(
    community_id: int,
    _: CommunityMember = Depends(require_community_role(ALL_ROLES)),
    db: Session = Depends(get_db),
):
    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    if not community.reserved_account_number:
        return None
    return ReservedAccountOut(
        bank_name=community.reserved_bank_name or "",
        account_number=community.reserved_account_number,
        account_name=community.reserved_account_name or "",
        status=community.reserved_account_status or "active",
    )


@router.post("/{community_id}/reserved-account", response_model=ReservedAccountOut)
async def setup_reserved_account(
    community_id: int,
    body: SetupReservedAccountIn,
    _: CommunityMember = Depends(require_community_role([MemberRole.ADMIN])),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.bvn:
        raise HTTPException(status_code=400, detail="BVN is required to create a reserved account")

    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    if community.reserved_account_number and community.reserved_account_status == "active":
        return ReservedAccountOut(
            bank_name=community.reserved_bank_name or "",
            account_number=community.reserved_account_number,
            account_name=community.reserved_account_name or "",
            status="active",
        )

    try:
        result = await monnify_service.create_reserved_account(
            community_id=community.id,
            community_name=community.name,
            admin_name=current_user.full_name or current_user.email,
            bvn=body.bvn,
        )
    except MonnifyError as exc:
        community.reserved_account_status = "failed"
        db.commit()
        return ReservedAccountOut(
            bank_name="",
            account_number="",
            account_name="",
            status="failed",
        )

    community.reserved_account_reference = f"acafund-comm-{community.id}"
    community.reserved_account_number = result["account_number"]
    community.reserved_bank_name = result["bank_name"]
    community.reserved_account_name = result["account_name"]
    community.reserved_account_status = result["status"]
    db.commit()

    return ReservedAccountOut(
        bank_name=community.reserved_bank_name or "",
        account_number=community.reserved_account_number,
        account_name=community.reserved_account_name or "",
        status=community.reserved_account_status,
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
