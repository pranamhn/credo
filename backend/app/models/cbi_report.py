import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class CbiReport(Base):
    __tablename__ = "cbi_reports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True, index=True
    )

    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)

    # Report metadata
    tanggal_laporan: Mapped[str] = mapped_column(String(64), nullable=True)
    npwp_query: Mapped[str] = mapped_column(String(32), nullable=True)

    # Debitur summary
    nama_debitur: Mapped[str] = mapped_column(String(256), nullable=True)
    npwp: Mapped[str] = mapped_column(String(32), nullable=True, index=True)
    jenis_badan_usaha: Mapped[str] = mapped_column(String(128), nullable=True)

    # Ringkasan
    jumlah_kreditur_aktif: Mapped[int] = mapped_column(Integer, nullable=True)
    jumlah_fasilitas_aktif: Mapped[int] = mapped_column(Integer, nullable=True)
    jumlah_kreditur_selesai: Mapped[int] = mapped_column(Integer, nullable=True)
    jumlah_fasilitas_selesai: Mapped[int] = mapped_column(Integer, nullable=True)

    # Full parsed payload stored as JSONB
    parsed_data: Mapped[dict] = mapped_column(JSONB, nullable=True)
    parse_error: Mapped[str] = mapped_column(Text, nullable=True)
    raw_pages: Mapped[int] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    company: Mapped["Company"] = relationship(back_populates="cbi_reports")  # type: ignore[name-defined]
