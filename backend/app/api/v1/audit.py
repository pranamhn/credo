from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.statement import Statement
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid

router = APIRouter(prefix="/audit", tags=["audit"])


class AuditLogOut(BaseModel):
    id: str
    action: str
    statement_id: Optional[str]
    original_filename: Optional[str]
    document_type: Optional[str]
    detail: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[AuditLogOut])
async def list_audit_logs(
    action: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(
            AuditLog.id,
            AuditLog.action,
            AuditLog.statement_id,
            AuditLog.detail,
            AuditLog.created_at,
            Statement.original_filename,
            Statement.document_type,
        )
        .outerjoin(Statement, AuditLog.statement_id == Statement.id)
        .order_by(desc(AuditLog.created_at))
        .limit(limit)
        .offset(offset)
    )
    if action:
        q = q.where(AuditLog.action == action)

    rows = (await db.execute(q)).all()
    return [
        AuditLogOut(
            id=str(r.id),
            action=r.action,
            statement_id=str(r.statement_id) if r.statement_id else None,
            original_filename=r.original_filename,
            document_type=r.document_type,
            detail=r.detail,
            created_at=r.created_at,
        )
        for r in rows
    ]
