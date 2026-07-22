from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.enums import ExpenseStatus


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False, index=True)
    collection_id = Column(Integer, ForeignKey("collections.id"), nullable=True)
    title = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    receipt_url = Column(String, nullable=True)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(ExpenseStatus, native_enum=False), nullable=False, default=ExpenseStatus.PENDING)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    decision_note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    decided_at = Column(DateTime(timezone=True), nullable=True)

    # Destination account (set by Treasurer at creation)
    destination_bank_name = Column(String, nullable=True)
    destination_account_number = Column(String, nullable=True)
    destination_account_name = Column(String, nullable=True)

    # Payout tracking (set when Admin/Treasurer marks as paid out)
    payout_reference = Column(String, nullable=True)
    paid_out_at = Column(DateTime(timezone=True), nullable=True)
    paid_out_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    community = relationship("Community")
    collection = relationship("Collection")
    requester = relationship("User", foreign_keys=[requested_by])
    decider = relationship("User", foreign_keys=[approved_by])
    payer = relationship("User", foreign_keys=[paid_out_by])
