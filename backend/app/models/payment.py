from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.enums import PaymentStatus


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("collections.id"), nullable=False, index=True)
    collection_member_id = Column(Integer, ForeignKey("collection_members.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    payment_reference = Column(String, unique=True, nullable=False, index=True)
    monnify_transaction_reference = Column(String, nullable=True)
    status = Column(Enum(PaymentStatus, native_enum=False), nullable=False, default=PaymentStatus.PENDING)
    checkout_url = Column(String, nullable=True)
    raw_verification_payload = Column(JSON, nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    collection = relationship("Collection")
    collection_member = relationship("CollectionMember")
    user = relationship("User")
