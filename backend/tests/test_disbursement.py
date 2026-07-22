"""Tests for the mark-paid-out flow and paid_out status transitions."""


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_user(client, email, name="User"):
    client.post("/auth/register", json={"email": email, "password": "pw", "full_name": name})
    token = client.post("/auth/login", json={"email": email, "password": "pw"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    return {"headers": headers, "id": user_id}


def _setup(client):
    """Returns admin, treasurer, auditor headers + community_id + expense_id."""
    admin = _make_user(client, "admin@dis.com", "Admin")
    comm = client.post(
        "/communities", json={"name": "Disburse Comm"}, headers=admin["headers"]
    ).json()
    comm_id = comm["id"]

    treasurer = _make_user(client, "treas@dis.com", "Treasurer")
    auditor = _make_user(client, "audit@dis.com", "Auditor")

    invite = comm["invite_code"]
    client.post("/communities/join", json={"invite_code": invite}, headers=treasurer["headers"])
    client.post("/communities/join", json={"invite_code": invite}, headers=auditor["headers"])

    client.patch(
        f"/communities/{comm_id}/members/{treasurer['id']}/role",
        json={"new_role": "treasurer"},
        headers=admin["headers"],
    )
    client.patch(
        f"/communities/{comm_id}/members/{auditor['id']}/role",
        json={"new_role": "auditor"},
        headers=admin["headers"],
    )

    expense_resp = client.post(
        f"/communities/{comm_id}/expenses",
        json={
            "title": "Projector",
            "amount": 25000,
            "category": "Equipment",
            "destination_bank_name": "GTBank",
            "destination_account_number": "0123456789",
            "destination_account_name": "Vendor Co",
        },
        headers=treasurer["headers"],
    )
    assert expense_resp.status_code == 201
    expense_id = expense_resp.json()["id"]

    return {
        "admin": admin,
        "treasurer": treasurer,
        "auditor": auditor,
        "comm_id": comm_id,
        "expense_id": expense_id,
    }


# ── status transition tests ───────────────────────────────────────────────────

def test_status_is_pending_after_creation(client):
    ctx = _setup(client)
    expenses = client.get(
        f"/communities/{ctx['comm_id']}/expenses",
        headers=ctx["admin"]["headers"],
    ).json()
    assert expenses[0]["status"] == "pending"


def test_status_is_approved_after_approval(client):
    ctx = _setup(client)
    client.post(
        f"/expenses/{ctx['expense_id']}/approve",
        json={"decision_note": None},
        headers=ctx["auditor"]["headers"],
    )
    expenses = client.get(
        f"/communities/{ctx['comm_id']}/expenses",
        headers=ctx["admin"]["headers"],
    ).json()
    assert expenses[0]["status"] == "approved"


def test_status_is_paid_out_after_mark_paid_out(client):
    ctx = _setup(client)
    client.post(
        f"/expenses/{ctx['expense_id']}/approve",
        json={"decision_note": None},
        headers=ctx["auditor"]["headers"],
    )
    client.post(
        f"/expenses/{ctx['expense_id']}/mark-paid-out",
        json={"payout_reference": "TXN-001"},
        headers=ctx["admin"]["headers"],
    )
    expenses = client.get(
        f"/communities/{ctx['comm_id']}/expenses",
        headers=ctx["admin"]["headers"],
    ).json()
    assert expenses[0]["status"] == "paid_out"


# ── mark-paid-out endpoint tests ──────────────────────────────────────────────

def test_mark_paid_out_requires_approved_status(client):
    ctx = _setup(client)
    resp = client.post(
        f"/expenses/{ctx['expense_id']}/mark-paid-out",
        json={"payout_reference": "TXN-001"},
        headers=ctx["admin"]["headers"],
    )
    assert resp.status_code == 409
    assert "approved" in resp.json()["detail"].lower()


def test_mark_paid_out_sets_fields(client):
    ctx = _setup(client)
    client.post(
        f"/expenses/{ctx['expense_id']}/approve",
        json={"decision_note": None},
        headers=ctx["auditor"]["headers"],
    )
    resp = client.post(
        f"/expenses/{ctx['expense_id']}/mark-paid-out",
        json={"payout_reference": "TXN-ABC"},
        headers=ctx["treasurer"]["headers"],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "paid_out"
    assert data["paid_out_at"] is not None
    assert data["paid_out_by"] == ctx["treasurer"]["id"]
    assert data["payout_reference"] == "TXN-ABC"
    assert data["destination_bank_name"] == "GTBank"
    assert data["destination_account_number"] == "0123456789"


def test_mark_paid_out_rejects_if_already_paid_out(client):
    ctx = _setup(client)
    client.post(
        f"/expenses/{ctx['expense_id']}/approve",
        json={"decision_note": None},
        headers=ctx["auditor"]["headers"],
    )
    client.post(
        f"/expenses/{ctx['expense_id']}/mark-paid-out",
        json={"payout_reference": "TXN-001"},
        headers=ctx["admin"]["headers"],
    )
    resp = client.post(
        f"/expenses/{ctx['expense_id']}/mark-paid-out",
        json={"payout_reference": "TXN-002"},
        headers=ctx["admin"]["headers"],
    )
    assert resp.status_code == 409


def test_mark_paid_out_forbidden_for_regular_member(client):
    ctx = _setup(client)
    member = _make_user(client, "member@dis.com", "Member")
    client.post(
        "/communities/join",
        json={"invite_code": client.get(
            f"/communities/{ctx['comm_id']}",
            headers=ctx["admin"]["headers"],
        ).json()["invite_code"]},
        headers=member["headers"],
    )
    client.post(
        f"/expenses/{ctx['expense_id']}/approve",
        json={},
        headers=ctx["auditor"]["headers"],
    )
    resp = client.post(
        f"/expenses/{ctx['expense_id']}/mark-paid-out",
        json={"payout_reference": "TXN-HACK"},
        headers=member["headers"],
    )
    assert resp.status_code == 403


# ── transparency report status tests ─────────────────────────────────────────

def _create_collection(client, comm_id, admin_headers):
    return client.post(
        f"/communities/{comm_id}/collections",
        json={"title": "Test Collection", "amount_per_member": 1000},
        headers=admin_headers,
    ).json()


def test_transparency_shows_correct_statuses(client):
    ctx = _setup(client)
    col = _create_collection(client, ctx["comm_id"], ctx["admin"]["headers"])
    col_id = col["id"]

    exp_resp = client.post(
        f"/communities/{ctx['comm_id']}/expenses",
        json={
            "title": "Linked Expense",
            "amount": 500,
            "category": "Misc",
            "collection_id": col_id,
        },
        headers=ctx["treasurer"]["headers"],
    )
    exp_id = exp_resp.json()["id"]

    # Stage 1: pending
    report = client.get(f"/collections/{col_id}/transparency").json()
    exp = next(e for e in report["expenses"] if e["title"] == "Linked Expense")
    assert exp["status"] == "pending"

    # Stage 2: approved
    client.post(f"/expenses/{exp_id}/approve", json={}, headers=ctx["auditor"]["headers"])
    report = client.get(f"/collections/{col_id}/transparency").json()
    exp = next(e for e in report["expenses"] if e["title"] == "Linked Expense")
    assert exp["status"] == "approved"

    # Stage 3: paid_out
    client.post(
        f"/expenses/{exp_id}/mark-paid-out",
        json={"payout_reference": "REF-001"},
        headers=ctx["admin"]["headers"],
    )
    report = client.get(f"/collections/{col_id}/transparency").json()
    exp = next(e for e in report["expenses"] if e["title"] == "Linked Expense")
    assert exp["status"] == "paid_out"
