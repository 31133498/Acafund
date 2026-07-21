from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.config import settings
from app.database import Base, engine

import app.models.user  # noqa: F401
import app.models.community  # noqa: F401
import app.models.collection  # noqa: F401
import app.models.payment  # noqa: F401
import app.models.ledger  # noqa: F401
import app.models.expense  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

# Broad CORS middleware — covers normal responses
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Raw middleware that stamps CORS headers on EVERY response (including 4xx/5xx)
# so the browser never misreads a backend error as a CORS block.
@app.middleware("http")
async def force_cors(request: Request, call_next):
    if request.method == "OPTIONS":
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "86400",
            },
        )
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

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
