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


def test_auditor_approve_writes_exactly_one_debit_ledger_entry(client, db_session):
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
    assert len(debits) == 1  # only one debit, never doubled


def test_user_cannot_approve_own_expense(client):
    """Treasurer creates expense; admin switches them to auditor; they cannot self-approve."""
    s = _setup_exp(client, "e5")

    # Treasurer creates expense
    expense_id = _create_expense(client, s["treasurer"]["headers"], s["comm"]["id"]).json()["id"]

    # Admin promotes the treasurer to auditor role
    _set_role(client, s["admin"]["headers"], s["comm"]["id"], s["treasurer"]["id"], "auditor")

    # That user (now auditor) tries to approve their own expense
    resp = client.post(
        f"/expenses/{expense_id}/approve",
        json={},
        headers=s["treasurer"]["headers"],  # same user, now auditor
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
        .filter(
            LedgerEntry.community_id == s["comm"]["id"],
        )
        .all()
    )
    assert len(entries) == 0


def test_ledger_balance_matches_computed_expectation(client, db_session):
    s = _setup_exp(client, "e7")

    # Seed one credit entry directly (stands in for a processed payment)
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

    # Approve two expenses → two debits
    eid1 = _create_expense(client, s["treasurer"]["headers"], s["comm"]["id"], amount=1200.0).json()["id"]
    eid2 = _create_expense(client, s["treasurer"]["headers"], s["comm"]["id"], amount=800.0).json()["id"]
    client.post(f"/expenses/{eid1}/approve", json={}, headers=s["auditor"]["headers"])
    client.post(f"/expenses/{eid2}/approve", json={}, headers=s["auditor"]["headers"])

    # Expected: 5000 (credit) - 1200 (debit) - 800 (debit) = 3000
    resp = client.get(f"/communities/{s['comm']['id']}/ledger", headers=s["admin"]["headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert data["balance"] == 3000.0
    assert data["total"] == 3  # 1 credit + 2 debits
