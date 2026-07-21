from datetime import datetime, timezone


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
    """Create a community with admin + 2 members. Returns dict with admin, m1, m2, comm."""
    admin = _make_user(client, f"admin{label}@col.com", "Admin")
    comm = _make_community(client, admin["headers"], f"Comm{label}")
    m1 = _make_user(client, f"m1{label}@col.com", "M1")
    m2 = _make_user(client, f"m2{label}@col.com", "M2")
    client.post("/communities/join", json={"invite_code": comm["invite_code"]}, headers=m1["headers"])
    client.post("/communities/join", json={"invite_code": comm["invite_code"]}, headers=m2["headers"])
    return {"admin": admin, "m1": m1, "m2": m2, "comm": comm}


def _create_collection(client, headers, community_id, **kwargs):
    body = {"title": "Monthly Dues", "amount_per_member": 1000.0}
    body.update(kwargs)
    resp = client.post(f"/communities/{community_id}/collections", json=body, headers=headers)
    return resp


# ── budget_allocation validation ──────────────────────────────────────────────

def test_budget_allocation_not_summing_to_100_rejected(client):
    s = _setup(client, "ba1")
    resp = _create_collection(
        client, s["admin"]["headers"], s["comm"]["id"],
        budget_allocation={"Food": 50, "Transport": 30},  # sums to 80
    )
    assert resp.status_code == 400
    assert "100" in resp.json()["detail"]


def test_budget_allocation_summing_to_100_accepted(client):
    s = _setup(client, "ba2")
    resp = _create_collection(
        client, s["admin"]["headers"], s["comm"]["id"],
        budget_allocation={"Food": 60, "Transport": 40},
    )
    assert resp.status_code == 201


def test_budget_allocation_none_accepted(client):
    s = _setup(client, "ba3")
    resp = _create_collection(client, s["admin"]["headers"], s["comm"]["id"])
    assert resp.status_code == 201


def test_budget_allocation_sums_to_100_with_floats(client):
    s = _setup(client, "ba4")
    resp = _create_collection(
        client, s["admin"]["headers"], s["comm"]["id"],
        budget_allocation={"A": 33.33, "B": 33.33, "C": 33.34},
    )
    assert resp.status_code == 201


# ── auto-enrollment ───────────────────────────────────────────────────────────

def test_create_collection_enrolls_all_current_members(client):
    s = _setup(client, "ae1")
    resp = _create_collection(client, s["admin"]["headers"], s["comm"]["id"])
    assert resp.status_code == 201
    col_id = resp.json()["id"]

    # Fetch detail — includes members array
    detail = client.get(f"/collections/{col_id}", headers=s["admin"]["headers"]).json()
    assert len(detail["members"]) == 3  # admin + m1 + m2
    enrolled_ids = {m["user_id"] for m in detail["members"]}
    assert s["admin"]["id"] in enrolled_ids
    assert s["m1"]["id"] in enrolled_ids
    assert s["m2"]["id"] in enrolled_ids


def test_enrolled_members_have_correct_amount_due(client):
    s = _setup(client, "ae2")
    resp = _create_collection(client, s["admin"]["headers"], s["comm"]["id"], amount_per_member=2500.0)
    col_id = resp.json()["id"]
    detail = client.get(f"/collections/{col_id}", headers=s["admin"]["headers"]).json()
    for m in detail["members"]:
        assert m["amount_due"] == 2500.0
        assert m["status"] == "pending"


def test_enrolled_members_do_not_include_later_joiners(client):
    s = _setup(client, "ae3")
    # Create collection (3 members at this point)
    resp = _create_collection(client, s["admin"]["headers"], s["comm"]["id"])
    col_id = resp.json()["id"]

    # A new member joins AFTER collection is created
    late = _make_user(client, "late@col.com", "Late")
    client.post("/communities/join", json={"invite_code": s["comm"]["invite_code"]}, headers=late["headers"])

    detail = client.get(f"/collections/{col_id}", headers=s["admin"]["headers"]).json()
    assert len(detail["members"]) == 3  # late joiner not enrolled
    assert late["id"] not in {m["user_id"] for m in detail["members"]}


# ── collection status / close ──────────────────────────────────────────────────

def test_new_collection_status_is_active(client):
    s = _setup(client, "st1")
    resp = _create_collection(client, s["admin"]["headers"], s["comm"]["id"])
    assert resp.json()["status"] == "active"


def test_admin_can_close_collection(client):
    s = _setup(client, "cl1")
    col_id = _create_collection(client, s["admin"]["headers"], s["comm"]["id"]).json()["id"]
    resp = client.patch(f"/collections/{col_id}/close", headers=s["admin"]["headers"])
    assert resp.status_code == 200
    assert resp.json()["status"] == "closed"


def test_non_admin_cannot_close_collection(client):
    s = _setup(client, "cl2")
    col_id = _create_collection(client, s["admin"]["headers"], s["comm"]["id"]).json()["id"]
    resp = client.patch(f"/collections/{col_id}/close", headers=s["m1"]["headers"])
    assert resp.status_code == 403


# ── access control ─────────────────────────────────────────────────────────────

def test_non_member_cannot_view_collection(client):
    s = _setup(client, "ac1")
    col_id = _create_collection(client, s["admin"]["headers"], s["comm"]["id"]).json()["id"]
    stranger = _make_user(client, "stranger@col.com", "Stranger")
    resp = client.get(f"/collections/{col_id}", headers=stranger["headers"])
    assert resp.status_code == 403


def test_non_member_cannot_view_dashboard(client):
    s = _setup(client, "ac2")
    col_id = _create_collection(client, s["admin"]["headers"], s["comm"]["id"]).json()["id"]
    stranger = _make_user(client, "stranger2@col.com", "Stranger2")
    resp = client.get(f"/collections/{col_id}/dashboard", headers=stranger["headers"])
    assert resp.status_code == 403


def test_non_admin_cannot_create_collection(client):
    s = _setup(client, "ac3")
    resp = _create_collection(client, s["m1"]["headers"], s["comm"]["id"])
    assert resp.status_code == 403


def test_member_can_list_collections(client):
    s = _setup(client, "ac4")
    _create_collection(client, s["admin"]["headers"], s["comm"]["id"])
    resp = client.get(f"/communities/{s['comm']['id']}/collections", headers=s["m1"]["headers"])
    assert resp.status_code == 200
    assert len(resp.json()) == 1


# ── dashboard math ─────────────────────────────────────────────────────────────

def test_dashboard_math_after_members_paid(client, db_session):
    from app.models.collection import CollectionMember
    from app.models.enums import MemberPaymentStatus

    s = _setup(client, "dm1")
    col_id = _create_collection(
        client, s["admin"]["headers"], s["comm"]["id"], amount_per_member=1000.0
    ).json()["id"]

    # Mark admin's CollectionMember as PAID via direct DB access
    col_members = (
        db_session.query(CollectionMember)
        .filter(CollectionMember.collection_id == col_id)
        .all()
    )
    assert len(col_members) == 3

    col_members[0].status = MemberPaymentStatus.PAID
    col_members[0].paid_at = datetime.now(timezone.utc)
    db_session.commit()

    resp = client.get(f"/collections/{col_id}/dashboard", headers=s["admin"]["headers"])
    assert resp.status_code == 200
    d = resp.json()

    assert d["total_members"] == 3
    assert d["paid_count"] == 1
    assert d["pending_count"] == 2
    assert d["waived_count"] == 0
    assert d["amount_collected"] == 1000.0
    assert d["amount_outstanding"] == 2000.0
    # target = 3000 (3 members × 1000), percent = 1000/3000 * 100 ≈ 33.33
    assert abs(d["percent_target_reached"] - 33.33) < 0.1


def test_dashboard_all_paid(client, db_session):
    from app.models.collection import CollectionMember
    from app.models.enums import MemberPaymentStatus

    s = _setup(client, "dm2")
    col_id = _create_collection(
        client, s["admin"]["headers"], s["comm"]["id"], amount_per_member=500.0
    ).json()["id"]

    col_members = (
        db_session.query(CollectionMember)
        .filter(CollectionMember.collection_id == col_id)
        .all()
    )
    now = datetime.now(timezone.utc)
    for m in col_members:
        m.status = MemberPaymentStatus.PAID
        m.paid_at = now
    db_session.commit()

    d = client.get(f"/collections/{col_id}/dashboard", headers=s["admin"]["headers"]).json()
    assert d["paid_count"] == 3
    assert d["pending_count"] == 0
    assert d["amount_collected"] == 1500.0
    assert d["amount_outstanding"] == 0.0
    assert d["percent_target_reached"] == 100.0
