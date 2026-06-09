from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Company, Statement, Transaction
from app.models.statement import StatementStatus
from app.schemas.company import CompanyCreate, CompanyRead, CompanySummary
from app.schemas.statement import StatementRead

router = APIRouter(prefix="/companies", tags=["companies"])


@router.post("", response_model=CompanyRead)
async def create_company(payload: CompanyCreate, db: AsyncSession = Depends(get_db)):
    name = " ".join(payload.name.split())
    if not name:
        raise HTTPException(400, "Nama perusahaan wajib diisi")

    company = Company(name=name, notes=payload.notes)
    db.add(company)
    await db.flush()
    await db.commit()
    await db.refresh(company)
    return company


@router.get("", response_model=list[CompanySummary])
async def list_companies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Company).order_by(Company.created_at.desc()))
    companies = result.scalars().all()
    return [await _summary_for_company(db, company) for company in companies]


@router.get("/{company_id}", response_model=CompanySummary)
async def get_company(company_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    return await _summary_for_company(db, company)


@router.get("/{company_id}/statements", response_model=list[StatementRead])
async def list_company_statements(company_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    result = await db.execute(
        select(Statement)
        .where(Statement.company_id == company_id)
        .order_by(Statement.created_at.desc())
    )
    return result.scalars().all()


async def _summary_for_company(db: AsyncSession, company: Company) -> CompanySummary:
    stmt_result = await db.execute(select(Statement).where(Statement.company_id == company.id))
    statements = stmt_result.scalars().all()
    statement_ids = [stmt.id for stmt in statements]

    total_credit = Decimal(0)
    total_debit = Decimal(0)
    total_transactions = 0
    if statement_ids:
        totals_result = await db.execute(
            select(
                func.count(Transaction.id),
                func.coalesce(func.sum(Transaction.credit), 0),
                func.coalesce(func.sum(Transaction.debit), 0),
            ).where(Transaction.statement_id.in_(statement_ids))
        )
        total_transactions_raw, total_credit_raw, total_debit_raw = totals_result.one()
        total_transactions = int(total_transactions_raw or 0)
        total_credit = Decimal(total_credit_raw or 0)
        total_debit = Decimal(total_debit_raw or 0)

    by_type = {doc_type: 0 for doc_type in ("bank_statement", "profit_loss", "cash_flow", "balance_sheet", "other")}
    for stmt in statements:
        by_type[stmt.document_type or "other"] = by_type.get(stmt.document_type or "other", 0) + 1

    latest = max(statements, key=lambda stmt: stmt.created_at, default=None)
    return CompanySummary(
        company=CompanyRead.model_validate(company),
        document_count=len(statements),
        successful_uploads=sum(1 for stmt in statements if stmt.status in (StatementStatus.done, StatementStatus.needs_review)),
        failed_uploads=sum(1 for stmt in statements if stmt.status == StatementStatus.failed),
        bank_statement_count=by_type.get("bank_statement", 0),
        profit_loss_count=by_type.get("profit_loss", 0),
        cash_flow_count=by_type.get("cash_flow", 0),
        balance_sheet_count=by_type.get("balance_sheet", 0),
        other_document_count=by_type.get("other", 0),
        total_transactions=total_transactions,
        total_credit=total_credit,
        total_debit=total_debit,
        latest_status=latest.status.value if latest else None,
    )
