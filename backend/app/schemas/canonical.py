"""
Canonical transaction schema — the unified internal representation
regardless of which bank or parsing method produced the data.
All adapters and the LLM fallback must output this format.
"""
from __future__ import annotations
from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class TransactionSource(str, Enum):
    adapter = "adapter"
    llm = "llm"
    manual = "manual"


class TransactionCategory(str, Enum):
    income_salary = "income_salary"
    income_transfer = "income_transfer"
    income_other = "income_other"
    transfer_out = "transfer_out"
    cash_withdrawal = "cash_withdrawal"
    admin_fee = "admin_fee"
    bank_fee = "bank_fee"
    loan_repayment = "loan_repayment"
    loan_disbursement = "loan_disbursement"
    vendor_payment = "vendor_payment"
    payroll = "payroll"
    operational_expense = "operational_expense"
    rent = "rent"
    transport = "transport"
    retail_purchase = "retail_purchase"
    ewallet_topup = "ewallet_topup"
    investment = "investment"
    tax = "tax"
    insurance = "insurance"
    utility = "utility"
    unknown = "unknown"


class TransactionFlag(str, Enum):
    judol = "judol"
    pinjol = "pinjol"
    passthrough = "passthrough"
    rejected = "rejected"
    negative_balance = "negative_balance"
    large_inflow = "large_inflow"
    recurring = "recurring"
    low_confidence = "low_confidence"


class CanonicalTransaction(BaseModel):
    row: int = Field(..., description="Row index in statement (1-based)")
    date: date
    value_date: Optional[date] = None
    description_raw: str
    description_normalized: Optional[str] = None

    debit: Optional[Decimal] = Field(None, ge=0)
    credit: Optional[Decimal] = Field(None, ge=0)
    balance: Optional[Decimal] = None

    category: TransactionCategory = TransactionCategory.unknown
    flags: list[TransactionFlag] = Field(default_factory=list)

    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    source: TransactionSource = TransactionSource.adapter
    raw_meta: Optional[dict] = None

    @model_validator(mode="after")
    def at_least_one_amount(self) -> "CanonicalTransaction":
        if self.debit is None and self.credit is None:
            raise ValueError("Transaction must have debit or credit")
        return self

    @property
    def amount(self) -> Decimal:
        if self.credit:
            return self.credit
        return -(self.debit or Decimal(0))

    @property
    def is_low_confidence(self) -> bool:
        return self.confidence < 0.85

    model_config = {"use_enum_values": True}


class ReconciliationResult(BaseModel):
    balanced: bool
    delta: Decimal = Decimal(0)
    computed_closing: Optional[Decimal] = None
    stated_closing: Optional[Decimal] = None
    unbalanced_rows: list[int] = Field(default_factory=list)
    notes: Optional[str] = None


class ParseMeta(BaseModel):
    parser_version: str = "1.0"
    method: TransactionSource = TransactionSource.adapter
    adapter_name: Optional[str] = None
    ocr: bool = False
    llm_used: bool = False
    template_version: Optional[int] = None
    processing_time_ms: Optional[int] = None


class CanonicalStatement(BaseModel):
    statement_id: Optional[UUID] = None
    bank_code: str
    bank_name: Optional[str] = None
    account_no_masked: Optional[str] = None
    account_holder: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    currency: str = "IDR"
    opening_balance: Optional[Decimal] = None
    closing_balance: Optional[Decimal] = None
    transactions: list[CanonicalTransaction] = Field(default_factory=list)
    reconciliation: Optional[ReconciliationResult] = None
    parse_meta: Optional[ParseMeta] = None
    detection_confidence: float = Field(default=1.0, ge=0.0, le=1.0)
