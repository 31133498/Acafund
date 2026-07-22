import json

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.collection import Collection, CollectionMember
from app.models.enums import CollectionStatus, ExpenseStatus, MemberPaymentStatus
from app.models.expense import Expense
from app.models.ledger import LedgerEntry
from app.services.ledger import get_balance

_SYSTEM_PROMPT = """\
You are a treasury assistant for an AcaFund community savings group.
Answer questions ONLY from the financial context provided. If the context
does not contain enough information to answer, say so explicitly — never
guess or invent a number. Be concise and direct."""

NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
MODEL = "nvidia/llama-3.3-nemotron-super-49b-v1"


def _build_context(db: Session, community_id: int) -> dict:
    balance = get_balance(db, community_id)

    recent_entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.community_id == community_id)
        .order_by(LedgerEntry.created_at.desc())
        .limit(10)
        .all()
    )

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
        members = (
            db.query(CollectionMember)
            .filter(CollectionMember.collection_id == col.id)
            .all()
        )
        paid = [m for m in members if m.status == MemberPaymentStatus.PAID]
        pending = [m for m in members if m.status == MemberPaymentStatus.PENDING]
        collections_summary.append({
            "id": col.id,
            "title": col.title,
            "target_amount": col.target_amount,
            "amount_collected": sum(m.amount_due for m in paid),
            "paid_count": len(paid),
            "pending_count": len(pending),
        })

    pending_expenses = (
        db.query(Expense)
        .filter(
            Expense.community_id == community_id,
            Expense.status == ExpenseStatus.PENDING,
        )
        .all()
    )

    return {
        "balance": balance,
        "recent_ledger": [
            {
                "type": e.type,
                "amount": e.amount,
                "description": e.description,
                "created_at": str(e.created_at),
            }
            for e in recent_entries
        ],
        "active_collections": collections_summary,
        "pending_expenses": [
            {
                "id": e.id,
                "title": e.title,
                "amount": e.amount,
                "category": e.category,
            }
            for e in pending_expenses
        ],
    }


async def ask_treasury_assistant(db: Session, community_id: int, question: str) -> str:
    context = _build_context(db, community_id)
    user_content = (
        f"Community Treasury Context:\n"
        f"{json.dumps(context, default=str, indent=2)}\n\n"
        f"Question: {question}"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            NVIDIA_URL,
            headers={
                "Authorization": f"Bearer {settings.nvidia_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                "max_tokens": 1024,
                "temperature": 0.2,
            },
        )

    if resp.status_code != 200:
        raise ValueError(f"NVIDIA API error {resp.status_code}: {resp.text}")

    return resp.json()["choices"][0]["message"]["content"]
