from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class CompanyCreate(BaseModel):
    name: str
    notes: str | None = None


class CompanyRead(BaseModel):
    id: UUID
    name: str
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CompanySummary(BaseModel):
    company: CompanyRead
    document_count: int
    successful_uploads: int
    failed_uploads: int
    bank_statement_count: int
    profit_loss_count: int
    cash_flow_count: int
    balance_sheet_count: int
    other_document_count: int
    total_transactions: int
    total_credit: Decimal
    total_debit: Decimal
    interest_expense: Decimal
    latest_status: str | None = None
