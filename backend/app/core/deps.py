from typing import List

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.enums import MemberRole


def require_community_role(allowed_roles: List[MemberRole]):
    def dependency(
        community_id: int,
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        from app.models.community import CommunityMember

        membership = (
            db.query(CommunityMember)
            .filter(
                CommunityMember.community_id == community_id,
                CommunityMember.user_id == current_user.id,
            )
            .first()
        )
        if not membership or membership.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return membership

    return dependency
