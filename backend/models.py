from __future__ import annotations
import enum
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
    Enum as SQLEnum
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class RoleEnum(str, enum.Enum):
    ADMIN = "admin"
    ENGINEER = "engineer"


class FWRequest(Base):
    __tablename__ = "fw_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    source_type: Mapped[str] = mapped_column(String(16), nullable=False)
    source_filename: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    input_count: Mapped[int] = mapped_column(Integer, nullable=False)
    hop_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING", index=True)
    engineer_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    raw_inputs: Mapped[dict] = mapped_column(JSONB, nullable=False)
    summary: Mapped[dict] = mapped_column(JSONB, nullable=False)

    hops: Mapped[List[FWHopRow]] = relationship(
        "FWHopRow", back_populates="request", cascade="all, delete-orphan"
    )
    ticket_number: Mapped[str] = mapped_column(String(16), nullable=True)
    submitted_by: Mapped[str] = mapped_column(String(64), nullable=True)
    updated_by: Mapped[str] = mapped_column(String(64), nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    configured_firewall: Mapped[dict] = mapped_column(JSONB, nullable=True)


class FWHopRow(Base):
    __tablename__ = "fw_hop_rows"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fw_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    hop_index: Mapped[int] = mapped_column(Integer, nullable=False)
    firewall_name: Mapped[Optional[str]] = mapped_column(String(128))
    vsys: Mapped[Optional[str]] = mapped_column(String(128))
    src_zone: Mapped[Optional[str]] = mapped_column(String(500))
    source_ip: Mapped[Optional[str]] = mapped_column(String(500))
    src_segment: Mapped[Optional[str]] = mapped_column(String(500))
    dst_zone: Mapped[Optional[str]] = mapped_column(String(500))
    destination_ip: Mapped[Optional[str]] = mapped_column(String(500))
    dst_segment: Mapped[Optional[str]] = mapped_column(String(500))
    services: Mapped[Optional[str]] = mapped_column(String(256))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    request: Mapped[FWRequest] = relationship("FWRequest", back_populates="hops")



class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[RoleEnum] = mapped_column(SQLEnum(RoleEnum), default=RoleEnum.ENGINEER, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # logs: Mapped[List["AuditLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    target_table: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    target_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    changes: Mapped[dict] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

#     user: Mapped[Optional["User"]] = relationship(back_populates="logs")


# class AuditLog(Base):
#     __tablename__ = "audit_logs"

#     id: Mapped[int] = mapped_column(primary_key=True, index=True)
#     user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
#     method: Mapped[str] = mapped_column(String(10), nullable=False)
#     endpoint: Mapped[str] = mapped_column(String(255), nullable=False)
#     status_code: Mapped[int] = mapped_column(Integer, nullable=False)
#     ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
#     timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

#     user: Mapped[Optional["User"]] = relationship(back_populates="logs")