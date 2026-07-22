import enum


class MemberRole(str, enum.Enum):
    ADMIN = "admin"
    TREASURER = "treasurer"
    AUDITOR = "auditor"
    MEMBER = "member"


class CollectionStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"


class MemberPaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    WAIVED = "waived"


class ExpenseStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    PAID_OUT = "paid_out"
    REJECTED = "rejected"


class LedgerEntryType(str, enum.Enum):
    CREDIT = "credit"
    DEBIT = "debit"
