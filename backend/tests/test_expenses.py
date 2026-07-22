from app.models.ledger import LedgerEntry
from app.models.enums import LedgerEntryType


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


def _set_role(client, admin_headers, community_id, user_id, new_role):
    resp = client.patch(
        f"/communities/{community_id}/members/{user_id}/role",
        json={"new_role": new_role},
        headers=admin_headers,
    )
    assert resp.status_code == 200


def _setup_exp(client, label=""):
    """Community with admin, treasurer, auditor, and a plain member."""
    admin = _make_user(client, f"admin{label}@exp.com", "Admin")
    comm = _make_community(client, admin["headers"], f"Comm{label}")

    treasurer = _make_user(client, f"tr{label}@exp.com", "Treasurer")
    auditor = _make_user(client, f"au{label}@exp.com", "Auditor")
    member = _make_user(client, f"mb{label}@exp.com", "Member")

    for u in (treasurer, auditor, member):
        client.post("/communities/join", json={"invite_code": comm["invite_code"]}, headers=u["headers"])

    _set_role(client, admin["headers"], comm["id"], treasurer["id"], "treasurer")
    _set_role(client, admin["headers"], comm["id"], auditor["id"], "auditor")

    return {
        "admin": admin,
        "treasurer": treasurer,
        "auditor": auditor,
        "member": member,
        "comm": comm,
    }


def _create_expense(client, headers, community_id, title="Office Supplies", amount=500.0):
    resp = client.post(
        f"/communities/{community_id}/expenses",
        json={"title": title, "amount": amount, "category": "Operations"},
        headers=headers,
    )
    return resp


# ── tests ─────────────────────────────────────────────────────────────────────

def test_treasurer_can_create_expense(client):
    s = _setup_exp(client, "e1")
    resp = _create_expense(client, s["treasurer"]["headers"], s["comm"]["id"])
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending"
    assert body["requested_by"] == s["treasurer"]["id"]
    assert body["community_id"] == s["comm"]["id"]


def test_member_cannot_create_expense(client):
    s = _setup_exp(client, "e2")
    resp = _create_expense(client, s["member"]["headers"], s["comm"]["id"])
    assert resp.status_code == 403


def test_approve_does_not_write_ledger_debit(client, db_session):
    """Approval sets status=approved but does NOT touch the ledger."""
    s = _setup_exp(client, "e3")
    expense_id = _create_expense(client, s["treasurer"]["headers"], s["comm"]["id"], amount=800.0).json()["id"]

    resp = client.post(
        f"/expenses/{expense_id}/approve",
        json={"decision_note": "Looks good"},
        headers=s["auditor"]["headers"],
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"

    debits = (
        db_session.query(LedgerEntry)
        .filter(
            LedgerEntry.community_id == s["comm"]["id"],
            LedgerEntry.type == LedgerEntryType.DEBIT,
        )
        .all()
    )
    assert len(debits) == 0


def test_mark_paid_out_writes_exactly_one_debit(client, db_session):
    """mark-paid-out sets status=paid_out and creates the ledger debit."""
    s = _setup_exp(client, "e3b")
    expense_id = _create_expense(client, s["treasurer"]["headers"], s["comm"]["id"], amount=800.0).json()["id"]

    client.post(f"/expenses/{expense_id}/approve", json={}, headers=s["auditor"]["headers"])

    resp = client.post(
        f"/expenses/{expense_id}/mark-paid-out",
        json={"payout_reference": "TXN-111"},
        headers=s["admin"]["headers"],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "paid_out"
    assert data["payout_reference"] == "TXN-111"
    assert data["paid_out_at"] is not None
    assert data["paid_out_by"] == s["admin"]["id"]

    debits = (
        db_session.query(LedgerEntry)
        .filter(
            LedgerEntry.community_id == s["comm"]["id"],
            LedgerEntry.type == LedgerEntryType.DEBIT,
            LedgerEntry.reference_type == "expense",
            LedgerEntry.reference_id == expense_id,
        )
        .all()
    )
    assert len(debits) == 1
    assert debits[0].amount == 800.0


def test_approving_expense_twice_is_rejected(client, db_session):
    s = _setup_exp(client, "e4")
    expense_id = _create_expense(client, s["treasurer"]["headers"], s["comm"]["id"]).json()["id"]

    client.post(f"/expenses/{expense_id}/approve", json={}, headers=s["auditor"]["headers"])
    resp = client.post(f"/expenses/{expense_id}/approve", json={}, headers=s["auditor"]["headers"])

    assert resp.status_code == 409

    debits = (
        db_session.query(LedgerEntry)
        .filter(
            LedgerEntry.reference_type == "expense",
            LedgerEntry.reference_id == expense_id,
        )
        .all()
    )
    assert len(debits) == 0


def test_mark_paid_out_requires_approved_status(client):
    """Cannot mark-paid-out a pending expense."""
    s = _setup_exp(client, "e4b")
    expense_id = _create_expense(client, s["treasurer"]["headers"], s["comm"]["id"]).json()["id"]

    resp = client.post(
        f"/expenses/{expense_id}/mark-paid-out",
        json={"payout_reference": "TXN-BAD"},
        headers=s["admin"]["headers"],
    )
    assert resp.status_code == 409
    assert "approved" in resp.json()["detail"].lower()


def test_mark_paid_out_forbidden_for_regular_member(client):
    s = _setup_exp(client, "e4c")
    expense_id = _create_expense(client, s["treasurer"]["headers"], s["comm"]["id"]).json()["id"]
    client.post(f"/expenses/{expense_id}/approve", json={}, headers=s["auditor"]["headers"])

    resp = client.post(
        f"/expenses/{expense_id}/mark-paid-out",
        json={"payout_reference": "TXN-HACK"},
        headers=s["member"]["headers"],
    )
    assert resp.status_code == 403


def test_user_cannot_approve_own_expense(client):
    """Treasurer creates expense; admin switches them to auditor; they cannot self-approve."""
    s = _setup_exp(client, "e5")

    expense_id = _create_expense(client, s["treasurer"]["headers"], s["comm"]["id"]).json()["id"]

    _set_role(client, s["admin"]["headers"], s["comm"]["id"], s["treasurer"]["id"], "auditor")

    resp = client.post(
        f"/expenses/{expense_id}/approve",
        json={},
        headers=s["treasurer"]["headers"],
    )
    assert resp.status_code == 403
    assert "own" in resp.json()["detail"].lower()


def test_rejected_expense_does_not_touch_ledger(client, db_session):
    s = _setup_exp(client, "e6")
    expense_id = _create_expense(client, s["treasurer"]["headers"], s["comm"]["id"], amount=300.0).json()["id"]

    resp = client.post(
        f"/expenses/{expense_id}/reject",
        json={"decision_note": "Out of budget"},
        headers=s["auditor"]["headers"],
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"

    entries = (
        db_session.query(LedgerEntry)
        .filter(LedgerEntry.community_id == s["comm"]["id"])
        .all()
    )
    assert len(entries) == 0


def test_ledger_balance_drops_only_after_paid_out(client, db_session):
    """Balance unchanged after approval; drops only after mark-paid-out."""
    s = _setup_exp(client, "e7")

    credit = LedgerEntry(
        community_id=s["comm"]["id"],
        type=LedgerEntryType.CREDIT,
        amount=5000.0,
        reference_type="payment",
        reference_id=9999,
        description="Test payment credit",
    )
    db_session.add(credit)
    db_session.commit()

    eid1 = _create_expense(client, s["treasurer"]["headers"], s["comm"]["id"], amount=1200.0).json()["id"]
    eid2 = _create_expense(client, s["treasurer"]["headers"], s["comm"]["id"], amount=800.0).json()["id"]

    client.post(f"/expenses/{eid1}/approve", json={}, headers=s["auditor"]["headers"])
    client.post(f"/expenses/{eid2}/approve", json={}, headers=s["auditor"]["headers"])

    # After approval only — balance still 5000
    resp = client.get(f"/communities/{s['comm']['id']}/ledger", headers=s["admin"]["headers"])
    assert resp.json()["balance"] == 5000.0

    # Mark both as paid out
    client.post(f"/expenses/{eid1}/mark-paid-out", json={"payout_reference": "REF-1"}, headers=s["admin"]["headers"])
    client.post(f"/expenses/{eid2}/mark-paid-out", json={"payout_reference": "REF-2"}, headers=s["admin"]["headers"])

    # 5000 - 1200 - 800 = 3000
    resp = client.get(f"/communities/{s['comm']['id']}/ledger", headers=s["admin"]["headers"])
    data = resp.json()
    assert data["balance"] == 3000.0
    assert data["total"] == 3  # 1 credit + 2 debits
