from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.enums import MemberRole


class Community(Base):
    __tablename__ = "communities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    invite_code = Column(String(8), unique=True, nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Monnify reserved account
    reserved_account_reference = Column(String, nullable=True)
    reserved_account_number = Column(String, nullable=True)
    reserved_bank_name = Column(String, nullable=True)
    reserved_account_name = Column(String, nullable=True)
    reserved_account_status = Column(String, nullable=True)

    creator = relationship("User", foreign_keys=[created_by])
    members = relationship("CommunityMember", back_populates="community")


class CommunityMember(Base):
    __tablename__ = "community_members"

    id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(Enum(MemberRole, native_enum=False), nullable=False, default=MemberRole.MEMBER)
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("community_id", "user_id", name="uq_community_member"),)

    community = relationship("Community", back_populates="members")
    user = relationship("User", back_populates="memberships")
