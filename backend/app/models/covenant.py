"""Covenant monitoring model — tracks financial covenant compliance per company."""

import uuid
from datetime import datetime

from sqlalchemy import String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Covenant(Base):
    __tablename__ = "covenants"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)

    covenant_type: Mapped[str] = mapped_column(String(32), nullable=False)
    # "dscr", "current_ratio", "der", "icr", "dsr", "max_exposure"

    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    operator: Mapped[str] = mapped_column(String(4), nullable=False)  # ">=", "<=", ">", "<"
    period: Mapped[str] = mapped_column(String(16), default="quarterly")  # "monthly", "quarterly", "annually"
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    notes: Mapped[str] = mapped_column(String(256), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company: Mapped["Company"] = relationship(back_populates="covenants")
