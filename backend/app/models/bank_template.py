import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class BankTemplate(Base):
    __tablename__ = "bank_templates"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    bank_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Detection config
    header_keywords: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    account_no_pattern: Mapped[str] = mapped_column(String(256), nullable=True)

    # Parsing config
    table_config: Mapped[dict] = mapped_column(JSONB, nullable=True)
    column_map: Mapped[dict] = mapped_column(JSONB, nullable=True)
    date_format: Mapped[str] = mapped_column(String(64), nullable=True)
    decimal_separator: Mapped[str] = mapped_column(String(4), default=",")
    thousand_separator: Mapped[str] = mapped_column(String(4), default=".")

    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
