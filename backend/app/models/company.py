from __future__ import annotations
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.slik_report import SlikReport
    from app.models.cbi_report import CbiReport
    from app.models.click_report import ClickReport


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    statements: Mapped[list["Statement"]] = relationship(back_populates="company")
    slik_reports: Mapped[list["SlikReport"]] = relationship(back_populates="company")
    cbi_reports: Mapped[list["CbiReport"]] = relationship(back_populates="company")
    click_reports: Mapped[list["ClickReport"]] = relationship(back_populates="company")
