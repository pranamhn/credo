from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base
from app.api.v1.companies import router as companies_router
from app.api.v1.statements import router as statements_router
from app.api.v1.slik import router as slik_router
from app.api.v1.cbi import router as cbi_router
from app.api.v1.click import router as click_router
from app.api.v1.audit import router as audit_router
import app.models.click_report  # noqa: F401 — register model so create_all sees it
import app.models.covenant  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (use Alembic for prod migrations)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.exec_driver_sql("ALTER TABLE statements ADD COLUMN IF NOT EXISTS company_id UUID NULL")
        await conn.exec_driver_sql("ALTER TABLE statements ADD COLUMN IF NOT EXISTS document_type VARCHAR(64) DEFAULT 'bank_statement'")
        await conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_statements_company_id ON statements (company_id)")
        await conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_statements_document_type ON statements (document_type)")
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Bank Statement Intelligence Platform — Risk Analyst",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(statements_router, prefix="/api/v1")
app.include_router(companies_router, prefix="/api/v1")
app.include_router(slik_router, prefix="/api/v1")
app.include_router(cbi_router, prefix="/api/v1")
app.include_router(click_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.app_version}
