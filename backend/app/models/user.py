import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class Role(str, enum.Enum):
    analyst = "analyst"
    risk_manager = "risk_manager"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role), nullable=False, default=Role.analyst)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    statements: Mapped[list["Statement"]] = relationship(back_populates="uploaded_by_user")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="user")
