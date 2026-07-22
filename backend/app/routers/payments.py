import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import get_current_user
from app.database import get_db
from app.models.collection import Collection, CollectionMember
from app.models.community import Community, CommunityMember
from app.models.enums import CollectionStatus, MemberPaymentStatus, MemberRole, PaymentStatus
from app.models.payment import Payment
from app.services.ledger import record_credit, record_direct_credit
from app.services.monnify import MonnifyError, monnify_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["payments"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PayInitIn(BaseModel):
    redirect_url: str


class PayInitOut(BaseModel):
    checkout_url: str
    payment_reference: str


class CollectionMemberOut(BaseModel):
    id: int
    collection_id: int
    user_id: int
    amount_due: float
    status: MemberPaymentStatus
    paid_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class PaymentOut(BaseModel):
    id: int
    collection_id: int
    user_id: int
    amount: float
    payment_reference: str
    monnify_transaction_reference: Optional[str] = None
    status: PaymentStatus
    checkout_url: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _reconcile_payment(payment: Payment, verification: dict, db: Session) -> None:
    """Mark payment + its CollectionMember as PAID and write a ledger credit.

    Callers must NOT commit beforehand; record_credit commits everything.
    """
    payment.status = PaymentStatus.PAID
    payment.raw_verification_payload = verification
    payment.paid_at = datetime.now(timezone.utc)

    col_member = (
        db.query(CollectionMember)
        .filter(CollectionMember.id == payment.collection_member_id)
        .first()
    )
    if col_member:
        col_member.status = MemberPaymentStatus.PAID
        col_member.paid_at = datetime.now(timezone.utc)

    col = db.query(Collection).filter(Collection.id == payment.collection_id).first()
    record_credit(
        db=db,
        community_id=col.community_id,
        amount=payment.amount,
        payment_id=payment.id,
        description=f"Payment {payment.payment_reference}",
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post(
    "/collections/{collection_id}/pay",
    status_code=status.HTTP_201_CREATED,
    response_model=PayInitOut,
)
async def initiate_payment(
    collection_id: int,
    body: PayInitIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    col = db.query(Collection).filter(Collection.id == collection_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    if col.status != CollectionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Collection is not active")

    if not db.query(CommunityMember).filter(
        CommunityMember.community_id == col.community_id,
        CommunityMember.user_id == current_user.id,
    ).first():
        raise HTTPException(status_code=403, detail="Not a community member")

    col_member = (
        db.query(CollectionMember)
        .filter(
            CollectionMember.collection_id == collection_id,
            CollectionMember.user_id == current_user.id,
        )
        .first()
    )
    if not col_member:
        raise HTTPException(status_code=403, detail="Not enrolled in this collection")
    if col_member.status != MemberPaymentStatus.PENDING:
        raise HTTPException(status_code=400, detail="No pending amount due")

    # Block duplicate in-flight payments for the same member slot
    existing = (
        db.query(Payment)
        .filter(
            Payment.collection_member_id == col_member.id,
            Payment.status == PaymentStatus.PENDING,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="A payment is already in progress for this collection")

    payment_reference = f"acafund-{collection_id}-{current_user.id}-{uuid4().hex[:8]}"

    payment = Payment(
        collection_id=collection_id,
        collection_member_id=col_member.id,
        user_id=current_user.id,
        amount=col_member.amount_due,
        payment_reference=payment_reference,
        status=PaymentStatus.PENDING,
    )
    db.add(payment)
    db.flush()

    try:
        result = await monnify_service.init_transaction(
            amount=col_member.amount_due,
            customer_name=current_user.full_name,
            customer_email=current_user.email,
            payment_reference=payment_reference,
            description=f"Payment for {col.title}",
            redirect_url=body.redirect_url,
        )
    except MonnifyError as e:
        db.rollback()
        raise HTTPException(status_code=502, detail=f"Payment gateway error: {e.message}")

    payment.checkout_url = result["checkoutUrl"]
    payment.monnify_transaction_reference = result.get("transactionReference")
    db.commit()

    return PayInitOut(checkout_url=payment.checkout_url, payment_reference=payment_reference)


@router.post("/webhooks/monnify", status_code=status.HTTP_200_OK)
async def monnify_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()

    # Validate signature only when the header is present (absent in sandbox)
    signature = request.headers.get("monnify-signature")
    if signature:
        computed = hashlib.sha512(
            settings.monnify_secret_key.encode() + raw_body
        ).hexdigest()
        if not hmac.compare_digest(computed, signature.lower()):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {"status": "invalid_json"}

    # Support both flat webhook shape and eventData-wrapped shape
    event_data = payload.get("eventData", payload)
    payment_reference = event_data.get("paymentReference") or payload.get("paymentReference")

    if payment_reference:
        payment = (
            db.query(Payment)
            .filter(Payment.payment_reference == payment_reference)
            .first()
        )
        if payment:
            if payment.status == PaymentStatus.PAID:
                return {"status": "already_paid"}
            try:
                verification = await monnify_service.verify_transaction(payment_reference)
            except MonnifyError:
                return {"status": "verification_failed"}
            payment_status_str = verification.get("paymentStatus", "")
            amount_paid = float(verification.get("amountPaid", 0))
            if payment_status_str in ("PAID", "OVERPAID") and amount_paid >= payment.amount:
                _reconcile_payment(payment, verification, db)
            return {"status": "ok"}

    # No matching Payment row — check for reserved-account direct transfer
    product = event_data.get("product", payload.get("product", {}))
    account_reference = product.get("reference", "")
    amount_paid = float(event_data.get("amountPaid") or payload.get("amountPaid") or 0)

    if account_reference.startswith("acafund-comm-"):
        community = (
            db.query(Community)
            .filter(Community.reserved_account_reference == account_reference)
            .first()
        )
        if community and amount_paid > 0:
            record_direct_credit(
                db=db,
                community_id=community.id,
                amount=amount_paid,
                reference_type="reserved_account_transfer",
                reference_id=community.id,
                description=f"Direct transfer via reserved account ({account_reference})",
                raw_payload=payload,
            )
            return {"status": "reserved_account_credit_recorded"}
        logger.warning("reserved account ref %s not matched to any community", account_reference)

    logger.info("webhook ignored — no matching payment or account reference")
    return {"status": "ignored"}


@router.post("/payments/{payment_id}/sync")
async def sync_payment(
    payment_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    col = db.query(Collection).filter(Collection.id == payment.collection_id).first()
    membership = (
        db.query(CommunityMember)
        .filter(
            CommunityMember.community_id == col.community_id,
            CommunityMember.user_id == current_user.id,
        )
        .first()
    )
    if not membership or membership.role != MemberRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin only")

    if payment.status == PaymentStatus.PAID:
        return {"status": "already_paid"}

    try:
        verification = await monnify_service.verify_transaction(payment.payment_reference)
    except MonnifyError as e:
        raise HTTPException(status_code=502, detail=f"Monnify error: {e.message}")

    payment_status_str = verification.get("paymentStatus", "")
    amount_paid = float(verification.get("amountPaid", 0))

    if payment_status_str in ("PAID", "OVERPAID") and amount_paid >= payment.amount:
        _reconcile_payment(payment, verification, db)
        return {"status": "reconciled"}

    return {"status": "not_paid", "monnify_status": payment_status_str}


@router.get("/collections/{collection_id}/payments/me", response_model=CollectionMemberOut)
def get_my_member_status(
    collection_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    col = db.query(Collection).filter(Collection.id == collection_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")

    if not db.query(CommunityMember).filter(
        CommunityMember.community_id == col.community_id,
        CommunityMember.user_id == current_user.id,
    ).first():
        raise HTTPException(status_code=403, detail="Not a community member")

    member = (
        db.query(CollectionMember)
        .filter(
            CollectionMember.collection_id == collection_id,
            CollectionMember.user_id == current_user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Not enrolled in this collection")
    return member
