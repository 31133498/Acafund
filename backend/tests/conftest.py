import os

# Force-set before any app import — overrides the container's PostgreSQL DATABASE_URL
# so all tests run against an isolated SQLite in-memory database.
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-at-least-32-chars!!"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient

# Importing app.main triggers model registration on Base (main.py imports all models).
from app.database import Base, SessionLocal, engine
from app.main import app  # noqa: F401 — side-effect: registers all models


@pytest.fixture(scope="function")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Direct DB session — shares the same SQLite StaticPool connection as the client."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
