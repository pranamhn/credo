import uuid
import enum
from datetime import datetime, date
from sqlalchemy import String, Enum, DateTime, Date, Numeric, Boolean, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class StatementStatus(str, enum.Enum):
    queued = "queued"
    parsing = "parsing"
    done = "done"
    needs_review = "needs_review"
    failed = "failed"


class Statement(Base):
    __tablename__ = "statements"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True, index=True)

    # File metadata
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    document_type: Mapped[str] = mapped_column(String(64), default="bank_statement", index=True)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=True)

    # Bank & period detection
    bank_code: Mapped[str] = mapped_column(String(20), nullable=True, index=True)
    bank_name: Mapped[str] = mapped_column(String(128), nullable=True)
    account_no_masked: Mapped[str] = mapped_column(String(64), nullable=True)
    account_holder: Mapped[str] = mapped_column(String(255), nullable=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=True)
    period_end: Mapped[date] = mapped_column(Date, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="IDR")

    # Financials summary
    opening_balance: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    closing_balance: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)

    # Status
    status: Mapped[StatementStatus] = mapped_column(Enum(StatementStatus), default=StatementStatus.queued, index=True)
    is_reconciled: Mapped[bool] = mapped_column(Boolean, default=False)
    reconciliation_delta: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)

    # Parse metadata
    parse_meta: Mapped[dict] = mapped_column(JSONB, nullable=True)
    parse_error: Mapped[str] = mapped_column(Text, nullable=True)
    is_scanned: Mapped[bool] = mapped_column(Boolean, default=False)
    detection_confidence: Mapped[float] = mapped_column(Numeric(4, 3), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    parsed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Relationships
    company: Mapped["Company"] = relationship(back_populates="statements")
    uploaded_by_user: Mapped["User"] = relationship(back_populates="statements")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="statement", cascade="all, delete-orphan")
    risk_result: Mapped["RiskResult"] = relationship(back_populates="statement", uselist=False, cascade="all, delete-orphan")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="statement")
