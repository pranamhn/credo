import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SlikReport(Base):
    __tablename__ = "slik_reports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True, index=True
    )

    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)

    # Report metadata
    nomor_laporan: Mapped[str] = mapped_column(String(128), nullable=True)
    tanggal_laporan: Mapped[str] = mapped_column(String(64), nullable=True)
    pemohon: Mapped[str] = mapped_column(String(256), nullable=True)

    # Debitur summary
    nama_debitur: Mapped[str] = mapped_column(String(256), nullable=True)
    no_identitas: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    npwp: Mapped[str] = mapped_column(String(32), nullable=True)
    tanggal_lahir: Mapped[str] = mapped_column(String(32), nullable=True)

    # Ringkasan
    jumlah_kreditur: Mapped[int] = mapped_column(Integer, nullable=True)
    jumlah_fasilitas: Mapped[int] = mapped_column(Integer, nullable=True)

    # Full parsed payload stored as JSONB for flexibility
    parsed_data: Mapped[dict] = mapped_column(JSONB, nullable=True)
    parse_error: Mapped[str] = mapped_column(Text, nullable=True)
    raw_pages: Mapped[int] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    company: Mapped["Company"] = relationship(back_populates="slik_reports")  # type: ignore[name-defined]
