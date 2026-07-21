import os

# Must be set before any app import so pydantic-settings picks them up.
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-at-least-32-chars!!")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient

# Importing app triggers model registration on Base.
import app.models.community  # noqa: F401
import app.models.user  # noqa: F401
from app.database import Base, engine
from app.main import app


@pytest.fixture(scope="function")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)
