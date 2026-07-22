from sqlalchemy.orm import Session

from app.models.enums import LedgerEntryType
from app.models.ledger import LedgerEntry


def record_credit(
    db: Session,
    community_id: int,
    amount: float,
    payment_id: int,
    description: str = "",
) -> LedgerEntry:
    entry = LedgerEntry(
        community_id=community_id,
        type=LedgerEntryType.CREDIT,
        amount=amount,
        reference_type="payment",
        reference_id=payment_id,
        description=description,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def record_direct_credit(
    db: Session,
    community_id: int,
    amount: float,
    reference_type: str,
    reference_id: int,
    description: str = "",
    raw_payload: dict | None = None,
) -> LedgerEntry:
    entry = LedgerEntry(
        community_id=community_id,
        type=LedgerEntryType.CREDIT,
        amount=amount,
        reference_type=reference_type,
        reference_id=reference_id,
        description=description,
        raw_payload=raw_payload,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def record_debit(
    db: Session,
    community_id: int,
    amount: float,
    reference_type: str,
    reference_id: int,
    description: str = "",
) -> LedgerEntry:
    entry = LedgerEntry(
        community_id=community_id,
        type=LedgerEntryType.DEBIT,
        amount=amount,
        reference_type=reference_type,
        reference_id=reference_id,
        description=description,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_balance(db: Session, community_id: int) -> float:
    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.community_id == community_id)
        .all()
    )
    balance = 0.0
    for entry in entries:
        if entry.type == LedgerEntryType.CREDIT:
            balance += entry.amount
        else:
            balance -= entry.amount
    return balance
