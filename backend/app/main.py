from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.database import Base, engine

import app.models.user  # noqa: F401
import app.models.community  # noqa: F401
import app.models.collection  # noqa: F401
import app.models.payment  # noqa: F401
import app.models.ledger  # noqa: F401
import app.models.expense  # noqa: F401

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
}


def _col_exists(conn, table: str, column: str) -> bool:
    row = conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": column}).first()
    return row is not None


def _migrate(engine):
    """Idempotent schema migration — renames legacy columns and adds missing ones."""
    import logging
    log = logging.getLogger("acafund.migrate")
    log.info("Running startup migrations...")

    with engine.begin() as conn:
        # communities: rename monnify_* → reserved_*
        for old, new in [
            ("monnify_account_reference", "reserved_account_reference"),
            ("monnify_account_number",    "reserved_account_number"),
            ("monnify_bank_name",         "reserved_bank_name"),
            ("monnify_account_name",      "reserved_account_name"),
        ]:
            if _col_exists(conn, "communities", old):
                conn.execute(text(f"ALTER TABLE communities RENAME COLUMN {old} TO {new}"))
                log.info("communities: renamed %s → %s", old, new)

        # communities: add columns that may be missing entirely
        for col, typedef in [
            ("reserved_account_reference", "VARCHAR"),
            ("reserved_account_number",    "VARCHAR"),
            ("reserved_bank_name",         "VARCHAR"),
            ("reserved_account_name",      "VARCHAR"),
            ("reserved_account_status",    "VARCHAR"),
        ]:
            if not _col_exists(conn, "communities", col):
                conn.execute(text(f"ALTER TABLE communities ADD COLUMN {col} VARCHAR"))
                log.info("communities: added missing column %s", col)

        # expenses: rename disbursed_* → paid_out_* / payout_reference
        for old, new in [
            ("disbursed_at",           "paid_out_at"),
            ("disbursed_by",           "paid_out_by"),
            ("disbursement_reference", "payout_reference"),
        ]:
            if _col_exists(conn, "expenses", old):
                conn.execute(text(f"ALTER TABLE expenses RENAME COLUMN {old} TO {new}"))
                log.info("expenses: renamed %s → %s", old, new)

        # expenses: add columns that may be missing entirely
        for col, typedef in [
            ("payout_reference", "VARCHAR"),
            ("paid_out_at",      "TIMESTAMP WITH TIME ZONE"),
            ("paid_out_by",      "INTEGER"),
        ]:
            if not _col_exists(conn, "expenses", col):
                conn.execute(text(f"ALTER TABLE expenses ADD COLUMN {col} {typedef}"))
                log.info("expenses: added missing column %s", col)

    log.info("Migrations complete.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _migrate(engine)
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Explicit exception handlers stamp CORS headers directly on error responses
# so the browser never sees a headerless 4xx/5xx as a CORS block.
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    headers = dict(CORS_HEADERS)
    if exc.headers:
        headers.update(exc.headers)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=CORS_HEADERS,
    )

from app.routers.auth import router as auth_router
from app.routers.communities import router as communities_router
from app.routers.collections import router as collections_router
from app.routers.payments import router as payments_router
from app.routers.expenses import router as expenses_router
from app.routers.reports import router as reports_router
from app.routers.assistant import router as assistant_router
from app.routers.users import router as users_router

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(communities_router)
app.include_router(collections_router)
app.include_router(payments_router)
app.include_router(expenses_router)
app.include_router(reports_router)
app.include_router(assistant_router)


@app.get("/health")
def health_check():
    return {"status": "ok", "app": settings.app_name, "env": settings.env}
