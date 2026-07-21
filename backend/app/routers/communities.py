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
from app.models.user import User

router = APIRouter(prefix="/communities", tags=["communities"])

ALL_ROLES = [MemberRole.ADMIN, MemberRole.TREASURER, MemberRole.AUDITOR, MemberRole.MEMBER]


class CreateCommunityIn(BaseModel):
    name: str
    description: Optional[str] = None


class JoinCommunityIn(BaseModel):
    invite_code: str


class ChangeRoleIn(BaseModel):
    new_role: MemberRole


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
    model_config = {"from_attributes": True}


class JoinOut(BaseModel):
    message: str
    community_id: int


def _unique_invite_code(db: Session) -> str:
    while True:
        code = secrets.token_urlsafe(6)[:8]
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
    community = db.query(Community).filter(Community.invite_code == body.invite_code).first()
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


@router.get("/{community_id}/members", response_model=List[MemberOut])
def list_members(
    community_id: int,
    _: CommunityMember = Depends(require_community_role(ALL_ROLES)),
    db: Session = Depends(get_db),
):
    return db.query(CommunityMember).filter(CommunityMember.community_id == community_id).all()


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
    return membership
