import json

import httpx
import pytest
import respx

from app.models.enums import LedgerEntryType
from app.models.ledger import LedgerEntry


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_user(client, email, name="User"):
    client.post("/auth/register", json={"email": email, "password": "pw", "full_name": name})
    token = client.post("/auth/login", json={"email": email, "password": "pw"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    return {"headers": headers, "id": user_id, "email": email, "name": name}


def _make_community(client, headers, name="Test Comm"):
    resp = client.post("/communities", json={"name": name, "description": ""}, headers=headers)
    assert resp.status_code == 201
    return resp.json()


def _set_role(client, admin_headers, community_id, user_id, new_role):
    resp = client.patch(
        f"/communities/{community_id}/members/{user_id}/role",
        json={"new_role": new_role},
        headers=admin_headers,
    )
    assert resp.status_code == 200


def _setup(client, label=""):
    admin = _make_user(client, f"admin{label}@rpt.com", f"Admin{label}")
    comm = _make_community(client, admin["headers"], f"Comm{label}")
    m1 = _make_user(client, f"m1{label}@rpt.com", f"Member{label}One")
    client.post("/communities/join", json={"invite_code": comm["invite_code"]}, headers=m1["headers"])
    return {"admin": admin, "m1": m1, "comm": comm}


def _setup_with_roles(client, label=""):
    """Community with admin, treasurer, auditor."""
    s = _setup(client, label)
    treasurer = _make_user(client, f"tr{label}@rpt.com", f"Treasurer{label}")
    auditor = _make_user(client, f"au{label}@rpt.com", f"Auditor{label}")
    client.post("/communities/join", json={"invite_code": s["comm"]["invite_code"]}, headers=treasurer["headers"])
    client.post("/communities/join", json={"invite_code": s["comm"]["invite_code"]}, headers=auditor["headers"])
    _set_role(client, s["admin"]["headers"], s["comm"]["id"], treasurer["id"], "treasurer")
    _set_role(client, s["admin"]["headers"], s["comm"]["id"], auditor["id"], "auditor")
    return {**s, "treasurer": treasurer, "auditor": auditor}


def _create_collection(client, headers, community_id, amount=1000.0):
    resp = client.post(
        f"/communities/{community_id}/collections",
        json={"title": "Monthly Dues", "amount_per_member": amount},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ── transparency tests ────────────────────────────────────────────────────────

def test_transparency_accessible_without_auth(client):
    s = _setup(client, "t1")
    col = _create_collection(client, s["admin"]["headers"], s["comm"]["id"])

    resp = client.get(f"/collections/{col['id']}/transparency")  # no Authorization header
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Monthly Dues"
    assert "paid_count" in data
    assert "pending_count" in data


def test_transparency_never_includes_member_emails_or_names(client):
    """Response body must contain zero PII — no emails, no full names."""
    admin = _make_user(client, "adminpii@rpt.com", "AdminPublicName")
    comm = _make_community(client, admin["headers"], "PII Check Comm")
    m1 = _make_user(client, "member.pii@rpt.com", "MemberPublicName")
    m2 = _make_user(client, "another.pii@rpt.com", "AnotherPublicName")
    client.post("/communities/join", json={"invite_code": comm["invite_code"]}, headers=m1["headers"])
    client.post("/communities/join", json={"invite_code": comm["invite_code"]}, headers=m2["headers"])

    col = _create_collection(client, admin["headers"], comm["id"])
    resp = client.get(f"/collections/{col['id']}/transparency")
    assert resp.status_code == 200

    body_text = resp.text
    for user in (admin, m1, m2):
        assert user["email"] not in body_text, f"Email {user['email']} leaked into transparency response"
        assert user["name"] not in body_text, f"Name {user['name']} leaked into transparency response"


# ── dashboard tests ───────────────────────────────────────────────────────────

def test_dashboard_numbers_match_ledger_state(client, db_session):
    s = _setup_with_roles(client, "d1")

    # Seed two credit entries directly (simulate processed payments)
    for amount in (4000.0, 1500.0):
        db_session.add(LedgerEntry(
            community_id=s["comm"]["id"],
            type=LedgerEntryType.CREDIT,
            amount=amount,
            reference_type="payment",
            reference_id=9000,
            description="seeded credit",
        ))
    db_session.commit()

    # Create, approve, and mark-paid-out an expense → one debit (800)
    exp_resp = client.post(
        f"/communities/{s['comm']['id']}/expenses",
        json={"title": "Stationery", "amount": 800.0, "category": "Ops"},
        headers=s["treasurer"]["headers"],
    )
    assert exp_resp.status_code == 201
    exp_id = exp_resp.json()["id"]
    client.post(f"/expenses/{exp_id}/approve", json={}, headers=s["auditor"]["headers"])
    client.post(
        f"/expenses/{exp_id}/mark-paid-out",
        json={"payout_reference": "TXN-STMT"},
        headers=s["admin"]["headers"],
    )

    # Create one active collection (m1 is enrolled, pending)
    _create_collection(client, s["admin"]["headers"], s["comm"]["id"], amount=500.0)

    # Create a pending expense (not yet approved)
    client.post(
        f"/communities/{s['comm']['id']}/expenses",
        json={"title": "Pending item", "amount": 200.0, "category": "Ops"},
        headers=s["treasurer"]["headers"],
    )

    resp = client.get(
        f"/communities/{s['comm']['id']}/dashboard",
        headers=s["admin"]["headers"],
    )
    assert resp.status_code == 200
    data = resp.json()

    # 4000 + 1500 (credits) - 800 (debit) = 4700
    assert data["treasury_balance"] == 4700.0
    assert data["pending_expenses_count"] == 1
    assert len(data["active_collections"]) == 1
    # Recent ledger: 3 entries (2 credits + 1 debit), all within limit of 10
    assert len(data["recent_ledger"]) == 3


# ── assistant tests ───────────────────────────────────────────────────────────

def test_assistant_context_contains_correct_balance(client, db_session):
    s = _setup(client, "a1")

    # Known balance: 7500 credit - 2500 debit = 5000
    db_session.add(LedgerEntry(
        community_id=s["comm"]["id"],
        type=LedgerEntryType.CREDIT,
        amount=7500.0,
        reference_type="payment",
        reference_id=1,
        description="credit",
    ))
    db_session.add(LedgerEntry(
        community_id=s["comm"]["id"],
        type=LedgerEntryType.DEBIT,
        amount=2500.0,
        reference_type="expense",
        reference_id=1,
        description="debit",
    ))
    db_session.commit()

    with respx.mock as m:
        # Assistant service calls NVIDIA, not Anthropic directly
        nvidia_route = m.post("https://integrate.api.nvidia.com/v1/chat/completions").mock(
            return_value=httpx.Response(200, json={
                "choices": [{"message": {"content": "The balance is 5000.0 NGN."}}],
                "model": "nvidia/llama-3.1-nemotron-70b-instruct",
                "usage": {"prompt_tokens": 120, "completion_tokens": 20},
            })
        )

        resp = client.post(
            f"/communities/{s['comm']['id']}/assistant/ask",
            json={"question": "What is the current treasury balance?"},
            headers=s["admin"]["headers"],
        )

    assert resp.status_code == 200
    assert resp.json()["answer"] == "The balance is 5000.0 NGN."

    # Inspect what was sent to NVIDIA — context must contain the correct balance
    assert nvidia_route.called
    sent = json.loads(nvidia_route.calls[0].request.content)
    assert sent["model"] == "nvidia/llama-3.1-nemotron-70b-instruct"
    user_content = sent["messages"][1]["content"]
    # The balance (5000.0) should appear in the serialised context
    assert "5000.0" in user_content
