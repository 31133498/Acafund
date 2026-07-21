import pytest


def _make_user(client, email, name="User"):
    client.post("/auth/register", json={"email": email, "password": "pw", "full_name": name})
    token = client.post("/auth/login", json={"email": email, "password": "pw"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    return {"headers": headers, "id": user_id}


def _make_community(client, headers, name="Test Comm"):
    resp = client.post("/communities", json={"name": name, "description": "desc"}, headers=headers)
    assert resp.status_code == 201
    return resp.json()


# ── creation ──────────────────────────────────────────────────────────────────

def test_create_community_makes_creator_admin(client):
    admin = _make_user(client, "admin@c.com")
    comm = _make_community(client, admin["headers"])

    members = client.get(f"/communities/{comm['id']}/members", headers=admin["headers"]).json()
    assert len(members) == 1
    assert members[0]["role"] == "admin"
    assert members[0]["user_id"] == admin["id"]


def test_created_community_has_invite_code(client):
    admin = _make_user(client, "admin2@c.com")
    comm = _make_community(client, admin["headers"])
    assert len(comm["invite_code"]) == 8


# ── joining ───────────────────────────────────────────────────────────────────

def test_join_via_invite_code_adds_as_member(client):
    admin = _make_user(client, "admin3@c.com")
    comm = _make_community(client, admin["headers"])

    member = _make_user(client, "member@c.com")
    resp = client.post("/communities/join", json={"invite_code": comm["invite_code"]}, headers=member["headers"])
    assert resp.status_code == 200

    roles = {m["user_id"]: m["role"] for m in client.get(
        f"/communities/{comm['id']}/members", headers=admin["headers"]
    ).json()}
    assert roles[member["id"]] == "member"


def test_invalid_invite_code_returns_404(client):
    user = _make_user(client, "u1@c.com")
    resp = client.post("/communities/join", json={"invite_code": "XXXXXXXX"}, headers=user["headers"])
    assert resp.status_code == 404


def test_joining_twice_returns_409(client):
    admin = _make_user(client, "admin4@c.com")
    comm = _make_community(client, admin["headers"])

    member = _make_user(client, "member2@c.com")
    client.post("/communities/join", json={"invite_code": comm["invite_code"]}, headers=member["headers"])
    resp = client.post("/communities/join", json={"invite_code": comm["invite_code"]}, headers=member["headers"])
    assert resp.status_code == 409


# ── access control ────────────────────────────────────────────────────────────

def test_non_member_cannot_get_community(client):
    admin = _make_user(client, "admin5@c.com")
    comm = _make_community(client, admin["headers"])

    stranger = _make_user(client, "stranger@c.com")
    resp = client.get(f"/communities/{comm['id']}", headers=stranger["headers"])
    assert resp.status_code == 403


def test_member_can_get_community(client):
    admin = _make_user(client, "admin6@c.com")
    comm = _make_community(client, admin["headers"])

    member = _make_user(client, "member3@c.com")
    client.post("/communities/join", json={"invite_code": comm["invite_code"]}, headers=member["headers"])

    resp = client.get(f"/communities/{comm['id']}", headers=member["headers"])
    assert resp.status_code == 200
    assert resp.json()["id"] == comm["id"]


def test_non_member_cannot_list_members(client):
    admin = _make_user(client, "admin7@c.com")
    comm = _make_community(client, admin["headers"])

    stranger = _make_user(client, "stranger2@c.com")
    resp = client.get(f"/communities/{comm['id']}/members", headers=stranger["headers"])
    assert resp.status_code == 403


# ── role management ───────────────────────────────────────────────────────────

def test_non_admin_cannot_change_role(client):
    admin = _make_user(client, "admin8@c.com")
    comm = _make_community(client, admin["headers"])

    member = _make_user(client, "member4@c.com")
    client.post("/communities/join", json={"invite_code": comm["invite_code"]}, headers=member["headers"])

    resp = client.patch(
        f"/communities/{comm['id']}/members/{admin['id']}/role",
        json={"new_role": "member"},
        headers=member["headers"],
    )
    assert resp.status_code == 403


def test_admin_can_change_member_role(client):
    admin = _make_user(client, "admin9@c.com")
    comm = _make_community(client, admin["headers"])

    member = _make_user(client, "member5@c.com")
    client.post("/communities/join", json={"invite_code": comm["invite_code"]}, headers=member["headers"])

    resp = client.patch(
        f"/communities/{comm['id']}/members/{member['id']}/role",
        json={"new_role": "treasurer"},
        headers=admin["headers"],
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "treasurer"


def test_change_role_on_nonexistent_member_returns_404(client):
    admin = _make_user(client, "admin10@c.com")
    comm = _make_community(client, admin["headers"])

    resp = client.patch(
        f"/communities/{comm['id']}/members/99999/role",
        json={"new_role": "auditor"},
        headers=admin["headers"],
    )
    assert resp.status_code == 404


def test_get_my_communities(client):
    user = _make_user(client, "mycomms@c.com")
    comm1 = _make_community(client, user["headers"], "Comm Alpha")

    other = _make_user(client, "other@c.com")
    comm2 = _make_community(client, other["headers"], "Comm Beta")
    # join comm2 as a member
    client.post("/communities/join", json={"invite_code": comm2["invite_code"]}, headers=user["headers"])

    resp = client.get("/users/me/communities", headers=user["headers"])
    assert resp.status_code == 200
    data = resp.json()
    ids = [c["id"] for c in data]
    assert comm1["id"] in ids
    assert comm2["id"] in ids
    # community the user has nothing to do with should not appear
    stranger = _make_user(client, "stranger@c.com")
    stranger_comm = _make_community(client, stranger["headers"], "Stranger Comm")
    resp2 = client.get("/users/me/communities", headers=user["headers"])
    assert stranger_comm["id"] not in [c["id"] for c in resp2.json()]
