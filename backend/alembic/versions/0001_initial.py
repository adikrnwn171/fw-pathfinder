"""initial schema: fw_requests and fw_hop_rows

Revision ID: 0001
Revises:
Create Date: 2026-06-26
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fw_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("source_type", sa.String(16), nullable=False),
        sa.Column("source_filename", sa.String(256), nullable=True),
        sa.Column("input_count", sa.Integer, nullable=False),
        sa.Column("hop_count", sa.Integer, nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="PENDING"),
        sa.Column("engineer_notes", sa.Text, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw_inputs", JSONB, nullable=False),
        sa.Column("summary", JSONB, nullable=False),
    )
    op.create_index("ix_fw_requests_submitted_at", "fw_requests", ["submitted_at"])
    op.create_index("ix_fw_requests_status", "fw_requests", ["status"])

    op.create_table(
        "fw_hop_rows",
        sa.Column(
            "id",
            sa.BigInteger,
            sa.Identity(always=True),
            primary_key=True,
        ),
        sa.Column(
            "request_id",
            UUID(as_uuid=True),
            sa.ForeignKey("fw_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("hop_index", sa.Integer, nullable=False),
        sa.Column("firewall_name", sa.String(128), nullable=True),
        sa.Column("vsys", sa.String(128), nullable=True),
        sa.Column("src_zone", sa.String(128), nullable=True),
        sa.Column("source_ip", sa.String(64), nullable=True),
        sa.Column("src_segment", sa.String(64), nullable=True),
        sa.Column("dst_zone", sa.String(128), nullable=True),
        sa.Column("destination_ip", sa.String(64), nullable=True),
        sa.Column("dst_segment", sa.String(64), nullable=True),
        sa.Column("services", sa.String(256), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
    )
    op.create_index("ix_fw_hop_rows_request_id", "fw_hop_rows", ["request_id"])


def downgrade() -> None:
    op.drop_table("fw_hop_rows")
    op.drop_table("fw_requests")
