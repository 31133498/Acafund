"""Tests for the reserved-account GET and POST endpoints."""
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
        "status": "ACTIVE",
        "accounts": [
            {"bankName": "Wema Bank", "accountNumber": "9876543210", "bankCode": "035A"}
        ],
    }
}


# ── GET /reserved-account ─────────────────────────────────────────────────────

def test_get_reserved_account_returns_null_when_not_set(client):
    headers = _register(client, "admin_get@ra.com")
    comm = client.post("/communities", json={"name": "No-Account Comm"}, headers=headers).json()
    resp = client.get(f"/communities/{comm['id']}/reserved-account", headers=headers)
    assert resp.status_code == 200
    assert resp.json() is None


# ── POST /reserved-account ────────────────────────────────────────────────────

@respx.mock
def test_post_reserved_account_stores_and_returns_active(client):
    respx.post(MONNIFY_TOKEN_URL).mock(return_value=httpx.Response(200, json=MOCK_TOKEN_RESP))
    respx.post(MONNIFY_RESERVE_URL).mock(return_value=httpx.Response(200, json=MOCK_RESERVE_RESP))

    headers = _register(client, "admin1@ra.com")
    comm = client.post("/communities", json={"name": "RA Community"}, headers=headers).json()

    resp = client.post(
        f"/communities/{comm['id']}/reserved-account",
        json={"bvn": "21212121212"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["account_number"] == "9876543210"
    assert data["bank_name"] == "Wema Bank"
    assert data["account_name"] == "Test Community"
    assert data["status"] == "active"


@respx.mock
def test_post_reserved_account_monnify_failure_returns_failed_not_500(client):
    respx.post(MONNIFY_TOKEN_URL).mock(return_value=httpx.Response(200, json=MOCK_TOKEN_RESP))
    respx.post(MONNIFY_RESERVE_URL).mock(return_value=httpx.Response(400, json={"error": "R42"}))

    headers = _register(client, "admin2@ra.com")
    comm = client.post("/communities", json={"name": "Failed Comm"}, headers=headers).json()

    resp = client.post(
        f"/communities/{comm['id']}/reserved-account",
        json={"bvn": "21212121212"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "failed"


@respx.mock
def test_post_reserved_account_is_idempotent(client):
    respx.post(MONNIFY_TOKEN_URL).mock(return_value=httpx.Response(200, json=MOCK_TOKEN_RESP))
    reserve_route = respx.post(MONNIFY_RESERVE_URL).mock(
        return_value=httpx.Response(200, json=MOCK_RESERVE_RESP)
    )

    headers = _register(client, "admin3@ra.com")
    comm = client.post("/communities", json={"name": "Idempotent Comm"}, headers=headers).json()
    comm_id = comm["id"]

    client.post(f"/communities/{comm_id}/reserved-account", json={"bvn": "21212121212"}, headers=headers)
    call_count = reserve_route.call_count

    resp = client.post(f"/communities/{comm_id}/reserved-account", json={"bvn": "21212121212"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["account_number"] == "9876543210"
    # Monnify NOT called again
    assert reserve_route.call_count == call_count


@respx.mock
def test_get_reserved_account_returns_stored_data_after_setup(client):
    respx.post(MONNIFY_TOKEN_URL).mock(return_value=httpx.Response(200, json=MOCK_TOKEN_RESP))
    respx.post(MONNIFY_RESERVE_URL).mock(return_value=httpx.Response(200, json=MOCK_RESERVE_RESP))

    headers = _register(client, "admin4@ra.com")
    comm = client.post("/communities", json={"name": "GET After Setup"}, headers=headers).json()
    comm_id = comm["id"]

    client.post(f"/communities/{comm_id}/reserved-account", json={"bvn": "21212121212"}, headers=headers)

    resp = client.get(f"/communities/{comm_id}/reserved-account", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["account_number"] == "9876543210"
    assert data["status"] == "active"


def test_post_reserved_account_requires_admin_role(client):
    admin_headers = _register(client, "admin5@ra.com")
    comm = client.post("/communities", json={"name": "Role Check Comm"}, headers=admin_headers).json()

    member_headers = _register(client, "member5@ra.com")
    client.post("/communities/join", json={"invite_code": comm["invite_code"]}, headers=member_headers)

    resp = client.post(
        f"/communities/{comm['id']}/reserved-account",
        json={"bvn": "21212121212"},
        headers=member_headers,
    )
    assert resp.status_code == 403


# ── webhook tests ─────────────────────────────────────────────────────────────

@respx.mock
def test_webhook_reserved_account_creates_ledger_credit(client):
    respx.post(MONNIFY_TOKEN_URL).mock(return_value=httpx.Response(200, json=MOCK_TOKEN_RESP))
    respx.post(MONNIFY_RESERVE_URL).mock(return_value=httpx.Response(200, json=MOCK_RESERVE_RESP))

    headers = _register(client, "admin6@ra.com")
    comm = client.post("/communities", json={"name": "Webhook Comm"}, headers=headers).json()
    comm_id = comm["id"]

    client.post(f"/communities/{comm_id}/reserved-account", json={"bvn": "21212121212"}, headers=headers)

    webhook_payload = {
        "eventType": "SUCCESSFUL_TRANSACTION",
        "eventData": {
            "product": {"reference": f"acafund-comm-{comm_id}", "type": "RESERVED_ACCOUNT"},
            "amountPaid": 5000.0,
            "paymentStatus": "PAID",
        },
    }
    resp = client.post("/webhooks/monnify", json=webhook_payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "reserved_account_credit_recorded"

    ledger = client.get(f"/communities/{comm_id}/ledger", headers=headers).json()
    assert ledger["balance"] == 5000.0
    assert ledger["entries"][0]["reference_type"] == "reserved_account_transfer"


def test_webhook_unrecognized_reference_returns_200(client):
    resp = client.post(
        "/webhooks/monnify",
        json={"paymentReference": "unknown-ref-xyz", "amountPaid": 100},
    )
    assert resp.status_code == 200
