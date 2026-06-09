import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    statement_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("statements.id"), nullable=True, index=True)

    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # upload | parse_start | parse_done | parse_failed | manual_correction | export | view | delete

    detail: Mapped[dict] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user: Mapped["User"] = relationship(back_populates="audit_logs")
    statement: Mapped["Statement"] = relationship(back_populates="audit_logs")
