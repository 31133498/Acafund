from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, JSON, String

from app.database import Base
from app.models.enums import LedgerEntryType


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False, index=True)
    type = Column(Enum(LedgerEntryType, native_enum=False), nullable=False)
    amount = Column(Float, nullable=False)
    reference_type = Column(String, nullable=False)
    reference_id = Column(Integer, nullable=False)
    description = Column(String, nullable=True)
    raw_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
