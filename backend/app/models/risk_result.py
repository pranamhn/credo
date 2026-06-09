import uuid
from datetime import datetime
from sqlalchemy import Numeric, DateTime, Boolean, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class RiskResult(Base):
    __tablename__ = "risk_results"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    statement_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("statements.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Cash flow metrics
    total_credit: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    total_debit: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    net_flow: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    avg_daily_balance: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    min_balance: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    max_balance: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    days_below_threshold: Mapped[int] = mapped_column(Integer, nullable=True)
    negative_balance_days: Mapped[int] = mapped_column(Integer, nullable=True)
    transaction_count: Mapped[int] = mapped_column(Integer, nullable=True)

    # DSR
    estimated_monthly_income: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    estimated_monthly_obligations: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    dsr: Mapped[float] = mapped_column(Numeric(5, 4), nullable=True)

    # Red flags (JSONB for flexible structure)
    flags: Mapped[dict] = mapped_column(JSONB, nullable=True, default=dict)
    flag_count: Mapped[int] = mapped_column(Integer, default=0)
    has_judol: Mapped[bool] = mapped_column(Boolean, default=False)
    has_pinjol: Mapped[bool] = mapped_column(Boolean, default=False)
    has_passthrough: Mapped[bool] = mapped_column(Boolean, default=False)

    # Composite score (Fase 2)
    risk_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)

    # Category breakdown
    category_summary: Mapped[dict] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    statement: Mapped["Statement"] = relationship(back_populates="risk_result")
