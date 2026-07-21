from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.community import Community, CommunityMember

router = APIRouter(prefix="/users", tags=["users"])


class CommunityOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    invite_code: str
    created_by: int
    model_config = {"from_attributes": True}


@router.get("/me/communities", response_model=List[CommunityOut])
def get_my_communities(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    memberships = (
        db.query(CommunityMember)
        .filter(CommunityMember.user_id == current_user.id)
        .all()
    )
    community_ids = [m.community_id for m in memberships]
    if not community_ids:
        return []
    return (
        db.query(Community)
        .filter(Community.id.in_(community_ids))
        .order_by(Community.id)
        .all()
    )
