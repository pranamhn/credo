from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel
from app.models.statement import StatementStatus


class StatementCreate(BaseModel):
    original_filename: str


class StatementUpdate(BaseModel):
    account_holder: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None


class StatementRead(BaseModel):
    id: UUID
    company_id: Optional[UUID] = None
    document_type: str = "bank_statement"
    original_filename: str
    bank_code: Optional[str]
    bank_name: Optional[str]
    account_no_masked: Optional[str]
    account_holder: Optional[str]
    period_start: Optional[date]
    period_end: Optional[date]
    currency: str
    opening_balance: Optional[Decimal]
    closing_balance: Optional[Decimal]
    status: StatementStatus
    is_reconciled: bool
    reconciliation_delta: Optional[Decimal]
    is_scanned: bool
    detection_confidence: Optional[float]
    statement_confidence: Optional[float] = None
    low_confidence_count: int = 0
    anomaly_count: int = 0
    page_count: int = 0
    parse_meta: Optional[dict] = None
    parse_error: Optional[str]
    created_at: datetime
    parsed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class TransactionRead(BaseModel):
    id: UUID
    row: int
    date: date
    value_date: Optional[date]
    description_raw: str
    description_normalized: Optional[str]
    debit: Optional[Decimal]
    credit: Optional[Decimal]
    balance: Optional[Decimal]
    category: Optional[str]
    flags: Optional[list[str]]
    confidence: Optional[float]
    source: Optional[str]
    is_low_confidence: bool
    is_manually_corrected: bool
    raw_meta: Optional[dict] = None

    model_config = {"from_attributes": True}


class TransactionPatch(BaseModel):
    description_raw: Optional[str] = None
    description_normalized: Optional[str] = None
    debit: Optional[Decimal] = None
    credit: Optional[Decimal] = None
    balance: Optional[Decimal] = None
    category: Optional[str] = None
    flags: Optional[list[str]] = None
