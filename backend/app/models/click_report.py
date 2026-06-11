import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ClickReport(Base):
    __tablename__ = "click_reports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True, index=True
    )

    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)

    # Report metadata
    tanggal_laporan: Mapped[str] = mapped_column(String(64), nullable=True)
    nama_debitur: Mapped[str] = mapped_column(String(256), nullable=True)
    no_identitas: Mapped[str] = mapped_column(String(32), nullable=True, index=True)

    # Score
    cb_score: Mapped[int] = mapped_column(Integer, nullable=True)
    risk_grade: Mapped[str] = mapped_column(String(16), nullable=True)

    # Ringkasan
    jumlah_kontrak: Mapped[int] = mapped_column(Integer, nullable=True)
    jumlah_kreditur: Mapped[int] = mapped_column(Integer, nullable=True)

    # Full parsed payload
    parsed_data: Mapped[dict] = mapped_column(JSONB, nullable=True)
    parse_error: Mapped[str] = mapped_column(Text, nullable=True)
    raw_pages: Mapped[int] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    company: Mapped["Company"] = relationship(back_populates="click_reports")  # type: ignore[name-defined]
