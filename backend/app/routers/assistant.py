from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_community_role
from app.database import get_db
from app.models.community import CommunityMember
from app.models.enums import MemberRole
from app.services.assistant import ask_treasury_assistant

router = APIRouter(tags=["assistant"])

ALL_ROLES = [MemberRole.ADMIN, MemberRole.TREASURER, MemberRole.AUDITOR, MemberRole.MEMBER]


class AskIn(BaseModel):
    question: str


class AskOut(BaseModel):
    answer: str


@router.post("/communities/{community_id}/assistant/ask", response_model=AskOut)
async def ask_assistant(
    community_id: int,
    body: AskIn,
    _: CommunityMember = Depends(require_community_role(ALL_ROLES)),
    db: Session = Depends(get_db),
):
    try:
        answer = await ask_treasury_assistant(db, community_id, body.question)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return AskOut(answer=answer)
