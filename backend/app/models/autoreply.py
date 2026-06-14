"""V4 — Instagram auto-reply (DM + comment) keyword rules and audit logs."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    String, Boolean, Integer, DateTime, ForeignKey, Text, Index, UniqueConstraint, JSON,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

# JSONB on PostgreSQL, plain JSON on SQLite (tests) — keeps the model portable.
JSONBType = JSONB().with_variant(JSON(), "sqlite")

from app.database import Base


class AutoReplyRule(Base):
    """A keyword/rule that triggers an automatic reply on DM or comment."""
    __tablename__ = "autoreply_rules"
    __table_args__ = (
        Index("ix_autoreply_rules_account_target_active", "account_id", "target", "is_active"),
        Index("ix_autoreply_rules_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    target: Mapped[str] = mapped_column(String(16), nullable=False)            # 'dm' | 'comment'
    match_type: Mapped[str] = mapped_column(String(16), nullable=False)        # contains|exact|starts_with|any
    keywords: Mapped[list] = mapped_column(JSONBType, nullable=False, default=list)
    case_sensitive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reply_text: Mapped[str] = mapped_column(Text, nullable=False)
    # Only used for target='comment': reply_public | reply_private | both
    comment_action: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # V6: multi-platform + AI reply mode
    platform: Mapped[str] = mapped_column(
        String(16), nullable=False, default="instagram", server_default="instagram"
    )
    reply_mode: Mapped[str] = mapped_column(
        String(16), nullable=False, default="template", server_default="template"
    )
    ai_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class AutoReplyLog(Base):
    """One row per inbound event processed — audit, analytics and idempotency."""
    __tablename__ = "autoreply_logs"
    __table_args__ = (
        # idempotency: never act twice on the same Instagram object
        UniqueConstraint("account_id", "ig_object_id", name="uq_autoreply_account_object"),
        Index("ix_autoreply_logs_account_created", "account_id", "created_at"),
        Index("ix_autoreply_logs_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    rule_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("autoreply_rules.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(16), nullable=False)        # 'dm' | 'comment'
    ig_object_id: Mapped[str] = mapped_column(String(255), nullable=False)     # comment_id / message_id
    # V6: multi-platform + AI reply mode tracking
    platform: Mapped[str] = mapped_column(
        String(16), nullable=False, default="instagram", server_default="instagram"
    )
    reply_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    sender_ig_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    incoming_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    matched_keyword: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reply_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # sent | skipped_no_match | skipped_rate_limit | skipped_24h | skipped_self | failed
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
