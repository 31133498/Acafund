"""Tests for Part A: Reserved Account per Community."""
import pytest
import respx
import httpx


# ── helpers ───────────────────────────────────────────────────────────────────

def _register(client, email, name="User"):
    client.post("/auth/register", json={"email": email, "password": "pw", "full_name": name})
    token = client.post("/auth/login", json={"email": email, "password": "pw"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


MONNIFY_TOKEN_URL = "https://sandbox.monnify.com/api/v1/auth/login"
MONNIFY_RESERVE_URL = "https://sandbox.monnify.com/api/v2/bank-transfer/reserved-accounts"

MOCK_TOKEN_RESP = {"responseBody": {"accessToken": "test-token"}}
MOCK_RESERVE_RESP = {
    "responseBody": {
        "accountName": "Test Community",
        "accounts": [
            {"bankName": "Wema Bank", "accountNumber": "9876543210", "bankCode": "035A"}
        ],
    }
}


# ── Part A tests ──────────────────────────────────────────────────────────────

@respx.mock
def test_community_creation_triggers_reserve_account(client):
    respx.post(MONNIFY_TOKEN_URL).mock(return_value=httpx.Response(200, json=MOCK_TOKEN_RESP))
    respx.post(MONNIFY_RESERVE_URL).mock(return_value=httpx.Response(200, json=MOCK_RESERVE_RESP))

    headers = _register(client, "admin@ra.com")
    resp = client.post("/communities", json={"name": "RA Community"}, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["monnify_account_number"] == "9876543210"
    assert data["monnify_bank_name"] == "Wema Bank"
    assert data["monnify_account_name"] == "Test Community"


@respx.mock
def test_community_creation_succeeds_even_if_reserve_account_fails(client):
    respx.post(MONNIFY_TOKEN_URL).mock(return_value=httpx.Response(401, json={"error": "bad creds"}))

    headers = _register(client, "admin2@ra.com")
    resp = client.post("/communities", json={"name": "Fallback Community"}, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    # Community created; Monnify fields are null
    assert data["id"] is not None
    assert data["monnify_account_number"] is None


@respx.mock
def test_setup_reserved_account_is_idempotent(client):
    # First call: Monnify succeeds
    respx.post(MONNIFY_TOKEN_URL).mock(return_value=httpx.Response(200, json=MOCK_TOKEN_RESP))
    reserve_route = respx.post(MONNIFY_RESERVE_URL).mock(
        return_value=httpx.Response(200, json=MOCK_RESERVE_RESP)
    )

    headers = _register(client, "admin3@ra.com")
    comm = client.post("/communities", json={"name": "Idempotent Comm"}, headers=headers).json()
    comm_id = comm["id"]

    # Community already has account from creation — setup should return existing without re-calling
    reserve_call_count_before = reserve_route.call_count
    resp = client.post(f"/communities/{comm_id}/reserved-account/setup", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["account_number"] == "9876543210"
    # Monnify reserve endpoint NOT called again
    assert reserve_route.call_count == reserve_call_count_before


@respx.mock
def test_setup_reserved_account_retries_if_missing(client):
    # Creation fails → account not set
    respx.post(MONNIFY_TOKEN_URL).mock(return_value=httpx.Response(401, json={}))
    headers = _register(client, "admin4@ra.com")
    comm = client.post("/communities", json={"name": "Retry Comm"}, headers=headers).json()
    comm_id = comm["id"]
    assert comm["monnify_account_number"] is None

    # Manual setup succeeds
    respx.post(MONNIFY_TOKEN_URL).mock(return_value=httpx.Response(200, json=MOCK_TOKEN_RESP))
    respx.post(MONNIFY_RESERVE_URL).mock(return_value=httpx.Response(200, json=MOCK_RESERVE_RESP))
    resp = client.post(f"/communities/{comm_id}/reserved-account/setup", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["account_number"] == "9876543210"


@respx.mock
def test_webhook_reserved_account_creates_ledger_credit(client):
    # Create community with a reserved account
    respx.post(MONNIFY_TOKEN_URL).mock(return_value=httpx.Response(200, json=MOCK_TOKEN_RESP))
    respx.post(MONNIFY_RESERVE_URL).mock(return_value=httpx.Response(200, json=MOCK_RESERVE_RESP))

    headers = _register(client, "admin5@ra.com")
    comm = client.post("/communities", json={"name": "Webhook Comm"}, headers=headers).json()
    comm_id = comm["id"]

    # Simulate Monnify reserved-account webhook (eventData-wrapped shape)
    webhook_payload = {
        "eventType": "SUCCESSFUL_TRANSACTION",
        "eventData": {
            "product": {"reference": f"acafund-community-{comm_id}", "type": "RESERVED_ACCOUNT"},
            "amountPaid": 5000.0,
            "paymentStatus": "PAID",
        },
    }
    resp = client.post("/webhooks/monnify", json=webhook_payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "reserved_account_credit_recorded"

    # Ledger should reflect the credit
    ledger = client.get(f"/communities/{comm_id}/ledger", headers=headers).json()
    assert ledger["balance"] == 5000.0
    assert ledger["entries"][0]["reference_type"] == "reserved_account_transfer"

    # No Payment row created
    from app.models.payment import Payment
    from app.database import SessionLocal
    db = SessionLocal()
    count = db.query(Payment).count()
    db.close()
    assert count == 0


def test_webhook_unrecognized_reference_returns_200(client):
    resp = client.post(
        "/webhooks/monnify",
        json={"paymentReference": "unknown-ref-xyz", "amountPaid": 100},
    )
    assert resp.status_code == 200
    # Should not crash
