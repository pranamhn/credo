from decimal import Decimal
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class RedFlagDetail(BaseModel):
    flag_type: str
    severity: str  # high | medium | low
    count: int
    total_amount: Optional[Decimal] = None
    supporting_rows: list[int] = []
    description: str
    confidence: float = 1.0


class RiskResultRead(BaseModel):
    id: UUID
    statement_id: UUID

    total_credit: Optional[Decimal]
    total_debit: Optional[Decimal]
    net_flow: Optional[Decimal]
    avg_daily_balance: Optional[Decimal]
    min_balance: Optional[Decimal]
    max_balance: Optional[Decimal]
    days_below_threshold: Optional[int]
    negative_balance_days: Optional[int]
    transaction_count: Optional[int]

    estimated_monthly_income: Optional[Decimal]
    estimated_monthly_obligations: Optional[Decimal]
    dsr: Optional[float]

    flags: Optional[dict]
    flag_count: int
    has_judol: bool
    has_pinjol: bool
    has_passthrough: bool
    risk_score: Optional[Decimal]

    category_summary: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}
