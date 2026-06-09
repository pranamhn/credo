import uuid
from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, Numeric, Integer, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    statement_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("statements.id", ondelete="CASCADE"), nullable=False, index=True)

    # Position in statement
    row: Mapped[int] = mapped_column(Integer, nullable=False)

    # Core fields
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    value_date: Mapped[date] = mapped_column(Date, nullable=True)
    description_raw: Mapped[str] = mapped_column(Text, nullable=False)
    description_normalized: Mapped[str] = mapped_column(Text, nullable=True)

    # Amounts (nullable to handle partial rows gracefully)
    debit: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    credit: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    balance: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)

    # Classification
    category: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    flags: Mapped[list] = mapped_column(ARRAY(String), nullable=True, default=list)

    # Quality
    confidence: Mapped[float] = mapped_column(Numeric(4, 3), nullable=True)
    source: Mapped[str] = mapped_column(String(16), nullable=True)  # adapter | llm | manual
    is_low_confidence: Mapped[bool] = mapped_column(Boolean, default=False)
    is_manually_corrected: Mapped[bool] = mapped_column(Boolean, default=False)

    # Extra metadata from parser
    raw_meta: Mapped[dict] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    statement: Mapped["Statement"] = relationship(back_populates="transactions")
