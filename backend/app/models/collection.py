from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.enums import CollectionStatus, MemberPaymentStatus


class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(String)
    amount_per_member = Column(Float, nullable=False)
    target_amount = Column(Float)
    deadline = Column(DateTime(timezone=True))
    budget_allocation = Column(JSON)
    status = Column(Enum(CollectionStatus, native_enum=False), nullable=False, default=CollectionStatus.ACTIVE)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    creator = relationship("User", foreign_keys=[created_by])
    members = relationship("CollectionMember", back_populates="collection", cascade="all, delete-orphan")


class CollectionMember(Base):
    __tablename__ = "collection_members"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("collections.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount_due = Column(Float, nullable=False)
    status = Column(Enum(MemberPaymentStatus, native_enum=False), nullable=False, default=MemberPaymentStatus.PENDING)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    collection = relationship("Collection", back_populates="members")
    user = relationship("User")
