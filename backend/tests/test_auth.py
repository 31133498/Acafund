import pytest


def _register(client, email="a@b.com", password="pw123", name="A B"):
    return client.post("/auth/register", json={"email": email, "password": password, "full_name": name})


def _login(client, email="a@b.com", password="pw123"):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_register_returns_bearer_token(client):
    resp = _register(client)
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_register_then_login_succeeds(client):
    _register(client, "user@test.com", "secret")
    resp = _login(client, "user@test.com", "secret")
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_wrong_password_rejected(client):
    _register(client, "user2@test.com", "correct")
    resp = _login(client, "user2@test.com", "wrong")
    assert resp.status_code == 401


def test_login_unknown_email_rejected(client):
    resp = _login(client, "nobody@test.com", "pw")
    assert resp.status_code == 401


def test_duplicate_email_registration_rejected(client):
    payload = {"email": "dupe@test.com", "password": "pw", "full_name": "Dupe"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 400


def test_me_returns_current_user(client):
    _register(client, "me@test.com", "pw", "Me User")
    token = _login(client, "me@test.com", "pw").json()["access_token"]
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "me@test.com"
    assert data["full_name"] == "Me User"
    assert "id" in data


def test_me_invalid_token_rejected(client):
    resp = client.get("/auth/me", headers={"Authorization": "Bearer not.a.real.token"})
    assert resp.status_code == 401


def test_me_tampered_jwt_rejected(client):
    _register(client, "tamper@test.com", "pw")
    token = _login(client, "tamper@test.com", "pw").json()["access_token"]
    bad_token = token[:-4] + "xxxx"
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {bad_token}"})
    assert resp.status_code == 401


def test_me_no_token_rejected(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401
