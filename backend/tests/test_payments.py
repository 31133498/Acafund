import pytest
import respx
import httpx

from app.models.ledger import LedgerEntry
from app.models.payment import Payment
from app.models.enums import PaymentStatus
from app.services.monnify import monnify_service

MONNIFY_BASE = "https://sandbox.monnify.com"


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_monnify_token():
    """Clear cached token before each test so mocks are always exercised."""
    monnify_service._token = None
    monnify_service._token_expiry = None
    yield


# ── shared helpers ────────────────────────────────────────────────────────────

def _make_user(client, email, name="User"):
    client.post("/auth/register", json={"email": email, "password": "pw", "full_name": name})
    token = client.post("/auth/login", json={"email": email, "password": "pw"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    return {"headers": headers, "id": user_id}


def _make_community(client, headers, name="Test Comm"):
    resp = client.post("/communities", json={"name": name, "description": ""}, headers=headers)
    assert resp.status_code == 201
    return resp.json()


def _setup(client, label=""):
    admin = _make_user(client, f"admin{label}@pay.com", "Admin")
    comm = _make_community(client, admin["headers"], f"Comm{label}")
    m1 = _make_user(client, f"m1{label}@pay.com", "M1")
    client.post("/communities/join", json={"invite_code": comm["invite_code"]}, headers=m1["headers"])
    return {"admin": admin, "m1": m1, "comm": comm}


def _create_collection(client, headers, community_id, amount=1000.0):
    resp = client.post(
        f"/communities/{community_id}/collections",
        json={"title": "Monthly Dues", "amount_per_member": amount},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


def _mock_login():
    return respx.post(f"{MONNIFY_BASE}/api/v1/auth/login").mock(
        return_value=httpx.Response(200, json={
            "responseBody": {"accessToken": "test-token", "expiresIn": 3600}
        })
    )


def _mock_init(checkout_url="https://sandbox.monnify.com/checkout/test123", tx_ref="MNFY|TEST|123"):
    return respx.post(f"{MONNIFY_BASE}/api/v1/merchant/transactions/init-transaction").mock(
        return_value=httpx.Response(200, json={
            "responseBody": {
                "checkoutUrl": checkout_url,
                "transactionReference": tx_ref,
            }
        })
    )


def _mock_verify(payment_status="PAID", amount_paid=1000.0):
    return respx.get(f"{MONNIFY_BASE}/api/v2/merchant/transactions/query").mock(
        return_value=httpx.Response(200, json={
            "responseBody": {
                "paymentStatus": payment_status,
                "amountPaid": amount_paid,
                "totalPayable": 1000.0,
            }
        })
    )


# ── tests ─────────────────────────────────────────────────────────────────────

def test_init_pay_creates_pending_payment_and_returns_checkout_url(client, db_session):
    s = _setup(client, "p1")
    col = _create_collection(client, s["admin"]["headers"], s["comm"]["id"])

    with respx.mock:
        _mock_login()
        _mock_init("https://sandbox.monnify.com/checkout/abc123")
        resp = client.post(
            f"/collections/{col['id']}/pay",
            json={"redirect_url": "https://acafund.app/done"},
            headers=s["m1"]["headers"],
        )

    assert resp.status_code == 201
    body = resp.json()
    assert body["checkout_url"] == "https://sandbox.monnify.com/checkout/abc123"
    assert "payment_reference" in body

    payments = db_session.query(Payment).filter(Payment.collection_id == col["id"]).all()
    assert len(payments) == 1
    assert payments[0].status == PaymentStatus.PENDING
    assert payments[0].user_id == s["m1"]["id"]


def test_webhook_verify_returns_pending_does_not_mark_payment_paid(client, db_session):
    s = _setup(client, "p2")
    col = _create_collection(client, s["admin"]["headers"], s["comm"]["id"])

    with respx.mock:
        _mock_login()
        _mock_init()
        init_resp = client.post(
            f"/collections/{col['id']}/pay",
            json={"redirect_url": "https://acafund.app/done"},
            headers=s["m1"]["headers"],
        )
    assert init_resp.status_code == 201
    pay_ref = init_resp.json()["payment_reference"]

    # Webhook fires, but verify returns PENDING — must not mark paid
    with respx.mock:
        _mock_login()
        _mock_verify(payment_status="PENDING", amount_paid=0)
        resp = client.post("/webhooks/monnify", json={"paymentReference": pay_ref})

    assert resp.status_code == 200

    payment = db_session.query(Payment).filter(Payment.payment_reference == pay_ref).first()
    db_session.refresh(payment)
    assert payment.status == PaymentStatus.PENDING


def test_webhook_duplicate_does_not_double_write_ledger(client, db_session):
    s = _setup(client, "p3")
    col = _create_collection(client, s["admin"]["headers"], s["comm"]["id"])

    with respx.mock:
        _mock_login()
        _mock_init()
        init_resp = client.post(
            f"/collections/{col['id']}/pay",
            json={"redirect_url": "https://acafund.app/done"},
            headers=s["m1"]["headers"],
        )
    pay_ref = init_resp.json()["payment_reference"]

    # First webhook — processes and marks PAID
    with respx.mock:
        _mock_login()
        _mock_verify(payment_status="PAID", amount_paid=1000.0)
        client.post("/webhooks/monnify", json={"paymentReference": pay_ref})

    # Second webhook — idempotency: must not write another ledger entry
    with respx.mock:
        _mock_login()
        _mock_verify(payment_status="PAID", amount_paid=1000.0)
        client.post("/webhooks/monnify", json={"paymentReference": pay_ref})

    payment = db_session.query(Payment).filter(Payment.payment_reference == pay_ref).first()
    entries = (
        db_session.query(LedgerEntry)
        .filter(
            LedgerEntry.reference_id == payment.id,
            LedgerEntry.reference_type == "payment",
        )
        .all()
    )
    assert len(entries) == 1


def test_webhook_amount_paid_less_than_amount_due_does_not_mark_paid(client, db_session):
    s = _setup(client, "p4")
    col = _create_collection(client, s["admin"]["headers"], s["comm"]["id"], amount=1000.0)

    with respx.mock:
        _mock_login()
        _mock_init()
        init_resp = client.post(
            f"/collections/{col['id']}/pay",
            json={"redirect_url": "https://acafund.app/done"},
            headers=s["m1"]["headers"],
        )
    pay_ref = init_resp.json()["payment_reference"]

    # Monnify claims PAID but amountPaid (500) < amount_due (1000)
    with respx.mock:
        _mock_login()
        _mock_verify(payment_status="PAID", amount_paid=500.0)
        client.post("/webhooks/monnify", json={"paymentReference": pay_ref})

    payment = db_session.query(Payment).filter(Payment.payment_reference == pay_ref).first()
    db_session.refresh(payment)
    assert payment.status == PaymentStatus.PENDING


def test_sync_reconciles_stuck_pending_payment(client, db_session):
    s = _setup(client, "p5")
    col = _create_collection(client, s["admin"]["headers"], s["comm"]["id"])

    with respx.mock:
        _mock_login()
        _mock_init()
        init_resp = client.post(
            f"/collections/{col['id']}/pay",
            json={"redirect_url": "https://acafund.app/done"},
            headers=s["m1"]["headers"],
        )
    pay_ref = init_resp.json()["payment_reference"]
    payment_id = db_session.query(Payment).filter(Payment.payment_reference == pay_ref).first().id

    # Admin manually syncs — verify returns PAID
    with respx.mock:
        _mock_login()
        _mock_verify(payment_status="PAID", amount_paid=1000.0)
        resp = client.post(f"/payments/{payment_id}/sync", headers=s["admin"]["headers"])

    assert resp.status_code == 200
    assert resp.json()["status"] == "reconciled"

    payment = db_session.query(Payment).filter(Payment.id == payment_id).first()
    db_session.refresh(payment)
    assert payment.status == PaymentStatus.PAID

    entries = (
        db_session.query(LedgerEntry)
        .filter(LedgerEntry.reference_id == payment_id, LedgerEntry.reference_type == "payment")
        .all()
    )
    assert len(entries) == 1
